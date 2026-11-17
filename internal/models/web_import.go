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
	"unicode"
	"unicode/utf8"

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
* go-readability and queues images for saving after the final course folder has
* been reserved. It fills SourceContent and SourceTitle (the article title,
* used when the user did not provide one).
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

	// Readability may remove the article title from its HTML. Preserve it in
	// the lesson even when the user chooses a different lesson title.
	articleTitle := strings.Join(strings.Fields(r.SourceTitle), " ")
	contentText := strings.Join(strings.Fields(article.TextContent), " ")
	if articleTitle != "" && !strings.Contains(strings.ToLower(contentText), strings.ToLower(articleTitle)) {
		content = "## " + webHeadingText(articleTitle) + "\n\n" + content
	}

	r.SourceContent = strings.TrimSpace(content)
	r.webSourceImages = images
	r.webSourceHost = parsed.Host
	return nil
}

// SaveWebSourceImages downloads the queued images into the reserved course
// folder and replaces their placeholders in the extracted content.
func (r *Research) SaveWebSourceImages(progress func(phase, detail string)) error {
	if progress != nil {
		progress("images", fmt.Sprintf("downloading %d images", len(r.webSourceImages)))
	}
	content, err := r.downloadWebImages(r.SourceContent, r.webSourceImages)
	if err != nil {
		return err
	}

	r.SourceContent = strings.TrimSpace(content)
	r.webSourceImages = nil
	if progress != nil {
		progress("done", fmt.Sprintf("%s (%d images)", r.webSourceHost, len(r.SourceImages)))
	}
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
* walkArticleHTML preserves basic markdown formatting and queues images in document
* order. Source text is escaped rather than allowing source HTML into the lesson.
**************************************************************************************/
func walkArticleHTML(contentHTML string, base *url.URL) (string, []webImageRef, error) {
	doc, err := html.Parse(strings.NewReader(contentHTML))
	if err != nil {
		return "", nil, fmt.Errorf("could not parse the article HTML: %w", err)
	}

	var b strings.Builder
	var para strings.Builder
	var images []webImageRef
	type listFrame struct {
		ordered bool
		index   int
		active  bool
		first   bool
	}
	var lists []*listFrame
	quotes := 0

	flushPara := func() {
		if text := strings.TrimSpace(para.String()); text != "" {
			prefix := strings.Repeat("> ", quotes)
			for _, list := range lists {
				if !list.active {
					continue
				}
				marker := "- "
				if list.ordered {
					marker = fmt.Sprintf("%d. ", list.index)
				}
				if list.first {
					prefix += marker
					list.first = false
				} else {
					prefix += strings.Repeat(" ", len(marker))
				}
			}
			b.WriteString(prefix)
			b.WriteString(strings.ReplaceAll(text, "\n", "\n"+strings.Repeat("> ", quotes)+strings.Repeat(" ", len(prefix)-2*quotes)))
			b.WriteString("\n\n")
		}
		para.Reset()
	}

	emitImage := func(n *html.Node) string {
		src := attrOf(n, "src")
		if src == "" || strings.HasPrefix(strings.ToLower(src), "data:") {
			// lazy-loaded images often carry the real URL in data-src
			src = attrOf(n, "data-src")
		}
		if src == "" || base == nil {
			return ""
		}
		resolved, err := base.Parse(src)
		if err != nil || resolved.Host == "" || (resolved.Scheme != "http" && resolved.Scheme != "https") {
			return ""
		}
		placeholder := fmt.Sprintf("[IMAGE_P%d]", len(images)+1)
		images = append(images, webImageRef{placeholder, resolved.String(), webImageAlt(attrOf(n, "alt"))})
		return placeholder
	}

	// Inline nodes are rendered once, including images inside links and emphasis.
	var inline func(*html.Node) string
	inline = func(n *html.Node) string {
		if n.Type == html.TextNode {
			return webMarkdownText(webCollapseSpace(n.Data))
		}
		if n.Type != html.ElementNode {
			return ""
		}
		switch n.Data {
		case "script", "style", "noscript", "iframe", "object":
			return ""
		case "img":
			return emitImage(n)
		case "br":
			return "  \n"
		}
		var children strings.Builder
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			children.WriteString(inline(c))
		}
		text := children.String()
		switch n.Data {
		case "b", "strong":
			return webWrapInline(text, "**", "**")
		case "i", "em":
			return webWrapInline(text, "*", "*")
		case "a":
			if destination := webLinkDestination(attrOf(n, "href"), base); destination != "" {
				return webWrapInline(text, "[", "]("+destination+")")
			}
		}
		return text
	}

	// Headings are plain chapter titles. If they contain images, emit each image
	// at its position and keep the first text segment as the chapter heading.
	writeHeading := func(n *html.Node) {
		flushPara()
		var text strings.Builder
		headingWritten := false
		flushText := func() {
			value := strings.Join(strings.Fields(text.String()), " ")
			text.Reset()
			if value == "" {
				return
			}
			if !headingWritten {
				b.WriteString("## " + webHeadingText(value) + "\n\n")
				headingWritten = true
			} else {
				b.WriteString(webMarkdownText(value) + "\n\n")
			}
		}
		var visit func(*html.Node)
		visit = func(c *html.Node) {
			if c.Type == html.TextNode {
				text.WriteString(webCollapseSpace(c.Data))
				return
			}
			if c.Type == html.ElementNode {
				switch c.Data {
				case "script", "style", "noscript", "iframe", "object":
					return
				case "img":
					if marker := emitImage(c); marker != "" {
						flushText()
						b.WriteString(marker + "\n\n")
					}
					return
				case "br":
					text.WriteByte(' ')
				}
			}
			for child := c.FirstChild; child != nil; child = child.NextSibling {
				visit(child)
			}
		}
		visit(n)
		flushText()
	}

	var walk func(n *html.Node)
	walk = func(n *html.Node) {
		if n.Type == html.ElementNode {
			switch n.Data {
			case "script", "style", "noscript", "iframe", "object":
				return
			case "h1", "h2", "h3", "h4", "h5", "h6":
				writeHeading(n)
				return
			case "p":
				if len(lists) == 0 && quotes == 0 && webEmphasizedHeading(n) {
					writeHeading(n)
					return
				}
				flushPara()
			case "center":
				if len(lists) == 0 && quotes == 0 && webCenteredHeading(n) {
					writeHeading(n)
					return
				}
			case "ul", "ol":
				flushPara()
				lists = append(lists, &listFrame{ordered: n.Data == "ol"})
				for c := n.FirstChild; c != nil; c = c.NextSibling {
					walk(c)
				}
				flushPara()
				lists = lists[:len(lists)-1]
				return
			case "li":
				flushPara()
				if len(lists) > 0 {
					list := lists[len(lists)-1]
					list.index++
					list.active, list.first = true, true
					defer func() { list.active = false }()
				}
			case "blockquote":
				flushPara()
				// Older pages sometimes use one blockquote for the entire article
				// as a layout container, not as a quotation.
				if webLayoutBlockquote(n) {
					for c := n.FirstChild; c != nil; c = c.NextSibling {
						walk(c)
					}
					flushPara()
					return
				}
				quotes++
				for c := n.FirstChild; c != nil; c = c.NextSibling {
					walk(c)
				}
				flushPara()
				quotes--
				return
			case "div", "section", "article", "figure", "figcaption", "table", "tr":
				flushPara()
			case "b", "strong", "i", "em", "u":
				if len(lists) == 0 && quotes == 0 && webStandaloneHeading(n) {
					writeHeading(n)
					return
				}
				para.WriteString(inline(n))
				return
			case "img", "a", "br":
				para.WriteString(inline(n))
				return
			}
		}
		if n.Type == html.TextNode {
			para.WriteString(webMarkdownText(webCollapseSpace(n.Data)))
			return
		}
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			walk(c)
		}
		if n.Type == html.ElementNode {
			switch n.Data {
			case "p", "li", "div", "section", "article", "figure", "figcaption", "table", "tr":
				flushPara()
			}
		}
	}

	walk(doc)
	flushPara()
	return b.String(), images, nil
}

var webSentenceStart = regexp.MustCompile(`(?i)^(i|we|you|he|she|it|they|this|that|these|those)\s+(am|are|is|was|were|have|has|had|do|does|did|will|would|can|could|should|must)\b`)
var webImageMarkerText = regexp.MustCompile(`\[IMAGE_(P)?[0-9]+\]`)

// A wrapper with several headings and paragraphs is likely page layout rather
// than a quotation. Keep genuine blockquotes inside it as quotations.
func webLayoutBlockquote(n *html.Node) bool {
	paragraphs, headings := 0, 0
	var visit func(*html.Node)
	visit = func(c *html.Node) {
		if c.Type == html.ElementNode && c.Data == "p" {
			paragraphs++
			if webEmphasizedHeading(c) {
				headings++
			}
		}
		for child := c.FirstChild; child != nil; child = child.NextSibling {
			visit(child)
		}
	}
	visit(n)
	return paragraphs >= 5 && headings >= 3
}

// Only fully emphasized, short title-like paragraphs become chapters.
func webEmphasizedHeading(n *html.Node) bool {
	var text strings.Builder
	valid := true
	var visit func(*html.Node, bool)
	visit = func(c *html.Node, emphasized bool) {
		if c.Type == html.TextNode {
			if strings.TrimSpace(c.Data) != "" && !emphasized {
				valid = false
			}
			text.WriteString(c.Data)
			return
		}
		if c.Type == html.ElementNode {
			switch c.Data {
			case "a", "img", "script", "style", "noscript", "br", "p", "div", "ul", "ol", "li", "blockquote":
				valid = false
				return
			case "b", "strong", "i", "em", "u":
				emphasized = true
			}
		}
		for child := c.FirstChild; child != nil; child = child.NextSibling {
			visit(child, emphasized)
		}
	}
	initiallyEmphasized := n.Data != "p"
	for child := n.FirstChild; child != nil; child = child.NextSibling {
		visit(child, initiallyEmphasized)
	}
	value := strings.Join(strings.Fields(text.String()), " ")
	if !valid || value == "" || utf8.RuneCountInString(value) > 160 || len(strings.Fields(value)) > 20 {
		return false
	}
	first, _ := utf8.DecodeRuneInString(value)
	if !unicode.IsLetter(first) && !unicode.IsDigit(first) {
		return false
	}
	return !strings.ContainsAny(value, ".!") && !webSentenceStart.MatchString(value)
}

// Some legacy pages place an emphasized heading directly between block nodes.
func webStandaloneHeading(n *html.Node) bool {
	if n.Parent == nil || (n.Parent.Data != "blockquote" && n.Parent.Data != "div" && n.Parent.Data != "section" && n.Parent.Data != "article") {
		return false
	}
	boundary := func(sibling *html.Node, previous bool) bool {
		for sibling != nil && (sibling.Type == html.CommentNode || (sibling.Type == html.TextNode && strings.TrimSpace(sibling.Data) == "")) {
			if previous {
				sibling = sibling.PrevSibling
			} else {
				sibling = sibling.NextSibling
			}
		}
		if sibling == nil {
			return true
		}
		if sibling.Type != html.ElementNode {
			return false
		}
		switch sibling.Data {
		case "p", "div", "section", "article", "blockquote", "ul", "ol", "h1", "h2", "h3", "h4", "h5", "h6", "br", "center":
			return true
		}
		return false
	}
	if !boundary(n.PrevSibling, true) || !boundary(n.NextSibling, false) || !webEmphasizedHeading(n) {
		return false
	}
	// A lone emphasized word between breaks is often part of a malformed
	// paragraph, not a section title.
	return len(strings.Fields(collectWebText(n))) >= 2
}

func collectWebText(n *html.Node) string {
	if n.Type == html.TextNode {
		return n.Data
	}
	var text strings.Builder
	for child := n.FirstChild; child != nil; child = child.NextSibling {
		text.WriteString(collectWebText(child))
	}
	return text.String()
}

// Legacy HTML often uses a centered large font instead of a heading element.
func webCenteredHeading(n *html.Node) bool {
	large := false
	var visit func(*html.Node)
	visit = func(c *html.Node) {
		if c.Type == html.ElementNode && (c.Data == "font" || c.Data == "span") {
			size := strings.TrimSpace(attrOf(c, "size"))
			if size == "4" || size == "5" || size == "6" || size == "7" {
				large = true
			}
		}
		for child := c.FirstChild; child != nil; child = child.NextSibling {
			visit(child)
		}
	}
	visit(n)
	return large && webEmphasizedHeading(n)
}

func webCollapseSpace(text string) string {
	var b strings.Builder
	space := false
	for _, r := range text {
		if unicode.IsSpace(r) {
			if !space {
				b.WriteByte(' ')
			}
			space = true
		} else {
			b.WriteRune(r)
			space = false
		}
	}
	return b.String()
}

// Escape both HTML and markdown syntax so source text cannot create markup.
func webMarkdownText(text string) string {
	var b strings.Builder
	for _, r := range text {
		switch r {
		case '&':
			b.WriteString("&amp;")
		case '<':
			b.WriteString("&lt;")
		case '>':
			b.WriteString("&gt;")
		default:
			if strings.ContainsRune("\\`*_{}[]()#+-.!|~", r) {
				b.WriteByte('\\')
			}
			b.WriteRune(r)
		}
	}
	return b.String()
}

func webHeadingText(text string) string {
	text = strings.NewReplacer("<", "&lt;", ">", "&gt;").Replace(text)
	return webImageMarkerText.ReplaceAllStringFunc(text, func(marker string) string {
		return "&#91;" + marker[1:len(marker)-1] + "&#93;"
	})
}

// The image alt is inserted later into markdown by runImport.
func webImageAlt(text string) string {
	var b strings.Builder
	for _, r := range strings.Join(strings.Fields(text), " ") {
		if r == '&' || r == '<' || r == '>' || r == '"' || r == '\'' || strings.ContainsRune("\\`*_{}[]()#+-.!|~", r) {
			fmt.Fprintf(&b, "&#%d;", r)
		} else {
			b.WriteRune(r)
		}
	}
	return b.String()
}

func webWrapInline(text, open, close string) string {
	trimmed := strings.TrimSpace(text)
	if trimmed == "" {
		return text
	}
	if open != "[" && strings.IndexFunc(trimmed, func(r rune) bool { return unicode.IsLetter(r) || unicode.IsDigit(r) }) < 0 {
		return text
	}
	start := strings.Index(text, trimmed)
	return text[:start] + open + trimmed + close + text[start+len(trimmed):]
}

func webLinkDestination(href string, base *url.URL) string {
	if href == "" || strings.IndexFunc(href, unicode.IsControl) >= 0 {
		return ""
	}
	escape := strings.NewReplacer("(", "%28", ")", "%29", "\\", "%5C", "<", "%3C", ">", "%3E", `"`, "%22", "'", "%27", " ", "%20", "&", "&amp;")
	safeDestination := func(value string) string {
		value = webImageMarkerText.ReplaceAllStringFunc(value, func(marker string) string {
			return "%5B" + marker[1:len(marker)-1] + "%5D"
		})
		return escape.Replace(value)
	}
	ref, err := url.Parse(href)
	if err != nil {
		return ""
	}
	if base == nil {
		return ""
	}
	resolved := base.ResolveReference(ref)
	switch strings.ToLower(resolved.Scheme) {
	case "http", "https":
		if resolved.Host == "" {
			return ""
		}
	case "mailto":
	default:
		return ""
	}
	return safeDestination(resolved.String())
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
