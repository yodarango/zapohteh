package models

import (
	"bytes"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/go-shiori/go-readability"
	"golang.org/x/net/html"
)

const (
	// webFetchTimeout caps how long fetching an article may take.
	webFetchTimeout = 30 * time.Second
	// maxWebBodyBytes caps the downloaded page size.
	maxWebBodyBytes = 10 << 20 // 10 MB
	// maxWebImageBytes caps each downloaded image.
	maxWebImageBytes = 5 << 20 // 5 MB
	// maxWebImages caps how many images are imported from one article.
	maxWebImages = 20
	// maxWebImagesTotalBytes caps the combined size of all imported images.
	maxWebImagesTotalBytes = 25 << 20 // 25 MB
	// webImageFetchTimeout caps each image download.
	webImageFetchTimeout = 20 * time.Second
)

// webUserAgent identifies the fetch as a regular desktop browser so servers do
// not reject the request as a bot.
const webUserAgent = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"

// webImageRef is an image found in the article HTML, queued for download. The
// placeholder is the temporary marker in the extracted text, swapped for the
// real [IMAGE_N] token once the image has been downloaded and saved.
type webImageRef struct {
	placeholder string
	url         string
	alt         string
}

// imagePlaceholderPattern matches the temporary [IMAGE_Pn] markers used while
// walking the article HTML.
var imagePlaceholderPattern = regexp.MustCompile(`\[IMAGE_P\d+\]`)

/**************************************************************************************
* ExtractWebSource fetches a web article, extracts its readable content with
* go-readability, turns the article HTML into plain text with [IMAGE_N] tokens
* where images were found and downloads those images. It fills SourceContent,
* SourceImages and SourceTitle (the article title, used when the user did not
* provide one). progress reports phases ("start", "text", "images", "done").
**************************************************************************************/
func (r *Research) ExtractWebSource(rawURL string, progress func(phase, detail string)) error {
	report := func(phase, detail string) {
		if progress != nil {
			progress(phase, detail)
		}
	}

	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil || parsed.Host == "" || (parsed.Scheme != "http" && parsed.Scheme != "https") {
		return fmt.Errorf("invalid URL: %s", rawURL)
	}

	report("start", parsed.Host)

	body, err := fetchWebPage(parsed.String())
	if err != nil {
		return err
	}

	article, err := readability.FromReader(bytes.NewReader(body), parsed)
	if err != nil {
		return fmt.Errorf("could not extract the article content: %w", err)
	}
	r.SourceTitle = strings.TrimSpace(article.Title)

	report("text", "extracting article text")
	content, images, err := walkArticleHTML(article.Content, parsed)
	if err != nil {
		return err
	}
	if strings.TrimSpace(content) == "" {
		return fmt.Errorf("no article content could be extracted from the page")
	}

	report("images", fmt.Sprintf("downloading %d images", len(images)))
	content, err = r.downloadWebImages(content, images)
	if err != nil {
		return err
	}

	r.SourceContent = strings.TrimSpace(content)
	report("done", fmt.Sprintf("%s (%d images)", parsed.Host, len(r.SourceImages)))
	return nil
}

// fetchWebPage downloads a web page with a desktop user agent, a timeout and a
// body size cap, returning clear errors for SSE progress reporting.
func fetchWebPage(pageURL string) ([]byte, error) {
	req, err := http.NewRequest(http.MethodGet, pageURL, nil)
	if err != nil {
		return nil, fmt.Errorf("invalid URL: %w", err)
	}
	req.Header.Set("User-Agent", webUserAgent)
	req.Header.Set("Accept", "text/html,application/xhtml+xml")

	client := &http.Client{Timeout: webFetchTimeout}
	resp, err := client.Do(req)
	if err != nil {
		if nerr, ok := err.(net.Error); ok && nerr.Timeout() {
			return nil, fmt.Errorf("could not fetch the URL: the server took too long to respond")
		}
		return nil, fmt.Errorf("could not fetch the URL: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("fetching the URL failed: the server returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(io.LimitReader(resp.Body, maxWebBodyBytes+1))
	if err != nil {
		return nil, fmt.Errorf("could not read the page: %w", err)
	}
	if len(body) > maxWebBodyBytes {
		return nil, fmt.Errorf("the page exceeds the %d MB limit", maxWebBodyBytes>>20)
	}
	return body, nil
}

/**************************************************************************************
* walkArticleHTML turns the readability article HTML into plain text: headings
* become markdown headings, block elements become paragraphs, and each <img> emits
* an [IMAGE_Pn] placeholder token in place while its (resolved) URL is queued for
* download. Script and style content is skipped.
**************************************************************************************/
func walkArticleHTML(contentHTML string, base *url.URL) (string, []webImageRef, error) {
	doc, err := html.Parse(strings.NewReader(contentHTML))
	if err != nil {
		return "", nil, fmt.Errorf("could not parse the article HTML: %w", err)
	}

	var b strings.Builder
	var para strings.Builder
	var images []webImageRef

	flushPara := func() {
		if text := strings.TrimSpace(para.String()); text != "" {
			b.WriteString(text)
			b.WriteString("\n\n")
		}
		para.Reset()
	}

	emitImage := func(n *html.Node) {
		src := attrOf(n, "src")
		if src == "" || strings.HasPrefix(src, "data:") {
			// lazy-loaded images often carry the real URL in data-src
			src = attrOf(n, "data-src")
		}
		if src == "" || strings.HasPrefix(src, "data:") {
			return
		}
		resolved, err := base.Parse(src)
		if err != nil {
			return
		}
		placeholder := fmt.Sprintf("[IMAGE_P%d]", len(images)+1)
		images = append(images, webImageRef{placeholder, resolved.String(), attrOf(n, "alt")})
		b.WriteString(placeholder)
		b.WriteString("\n\n")
	}

	var walk func(n *html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.ElementNode {
			switch n.Data {
			case "script", "style", "noscript":
				return
			case "img":
				flushPara()
				emitImage(n)
				return
			case "h1", "h2", "h3", "h4", "h5", "h6":
				flushPara()
				if text := collectText(n); text != "" {
					b.WriteString("## " + text + "\n\n")
				}
				return
			case "p", "li", "blockquote", "figcaption", "tr", "br":
				flushPara()
			}
		}
		if n.Type == html.TextNode {
			para.WriteString(n.Data)
			para.WriteString(" ")
			return
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
		if n.Type == html.ElementNode {
			switch n.Data {
			case "p", "li", "blockquote", "figcaption", "tr":
				flushPara()
			}
		}
	}

	walk(doc)
	flushPara()
	return b.String(), images, nil
}

// collectText returns the concatenated text of a node and its descendants.
func collectText(n *html.Node) string {
	var parts []string
	var walk func(*html.Node)
	walk = func(c *html.Node) {
		if c.Type == html.TextNode {
			parts = append(parts, c.Data)
		}
		for ch := c.FirstChild; ch != nil; ch = ch.NextSibling {
			walk(ch)
		}
	}
	walk(n)
	return strings.Join(strings.Fields(strings.Join(parts, " ")), " ")
}

// attrOf returns the trimmed value of an HTML attribute, or "" when absent.
func attrOf(n *html.Node, key string) string {
	for _, a := range n.Attr {
		if a.Key == key {
			return strings.TrimSpace(a.Val)
		}
	}
	return ""
}

/**************************************************************************************
* downloadWebImages downloads the queued article images within the count and size
* caps, saves the ones that succeed and swaps their placeholder tokens for the
* real [IMAGE_N] tokens. Placeholders of images that failed are stripped.
**************************************************************************************/
func (r *Research) downloadWebImages(content string, images []webImageRef) (string, error) {
	client := &http.Client{Timeout: webImageFetchTimeout}

	replacements := make(map[string]string)
	total := 0
	saved := 0
	for _, ref := range images {
		if saved >= maxWebImages || total >= maxWebImagesTotalBytes {
			break
		}
		data, ext, err := downloadWebImage(client, ref.url)
		if err != nil {
			continue // skip images that fail to download
		}
		if total+len(data) > maxWebImagesTotalBytes {
			break
		}
		alt := ref.alt
		if alt == "" {
			alt = fmt.Sprintf("Image %d from the article", saved+1)
		}
		img, err := r.saveSourceImage(data, ext, alt)
		if err != nil {
			return "", fmt.Errorf("failed to save an article image: %w", err)
		}
		replacements[ref.placeholder] = img.Token
		total += len(data)
		saved++
	}

	for placeholder, token := range replacements {
		content = strings.ReplaceAll(content, placeholder, token)
	}
	return imagePlaceholderPattern.ReplaceAllString(content, ""), nil
}

// downloadWebImage fetches a single image, enforcing the Content-Type allowlist
// and the per-image size cap, and returns its bytes and file extension.
func downloadWebImage(client *http.Client, imageURL string) ([]byte, string, error) {
	req, err := http.NewRequest(http.MethodGet, imageURL, nil)
	if err != nil {
		return nil, "", err
	}
	req.Header.Set("User-Agent", webUserAgent)

	resp, err := client.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, "", fmt.Errorf("status %d", resp.StatusCode)
	}

	ext := webImageExtension(resp.Header.Get("Content-Type"), imageURL)
	if ext == "" {
		return nil, "", fmt.Errorf("unsupported image type %q", resp.Header.Get("Content-Type"))
	}

	data, err := io.ReadAll(io.LimitReader(resp.Body, maxWebImageBytes+1))
	if err != nil {
		return nil, "", err
	}
	if len(data) == 0 {
		return nil, "", fmt.Errorf("empty image")
	}
	if len(data) > maxWebImageBytes {
		return nil, "", fmt.Errorf("image exceeds the %d MB limit", maxWebImageBytes>>20)
	}
	return data, ext, nil
}

// webImageExtension maps an allowed image Content-Type to a file extension,
// falling back to the URL extension when the server sends no useful type.
func webImageExtension(contentType, imageURL string) string {
	ct := strings.ToLower(strings.TrimSpace(strings.Split(contentType, ";")[0]))
	switch ct {
	case "image/jpeg":
		return "jpg"
	case "image/png":
		return "png"
	case "image/webp":
		return "webp"
	case "image/gif":
		return "gif"
	}
	if ct != "" && ct != "application/octet-stream" && ct != "binary/octet-stream" {
		return ""
	}
	path := imageURL
	if i := strings.IndexAny(path, "?#"); i >= 0 {
		path = path[:i]
	}
	switch strings.ToLower(path[strings.LastIndex(path, ".")+1:]) {
	case "jpg", "jpeg":
		return "jpg"
	case "png":
		return "png"
	case "webp":
		return "webp"
	case "gif":
		return "gif"
	}
	return ""
}
