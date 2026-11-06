/* *************************************************************************************************
 * Posts a JSON body to an endpoint and reads back a Server-Sent Events stream. For every event
 * received it calls onEvent with the parsed event name and its raw data string. This is used to
 * report long running progress (such as a research being built chapter by chapter) to the UI.
 * *************************************************************************************************
 */
export async function streamPost(props) {
  const { url, body, onEvent, options = {} } = props;

  // FormData bodies are sent as-is so the browser sets the multipart boundary;
  // everything else goes out as JSON.
  const isFormData = body instanceof FormData;

  const response = await fetch(url, {
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
      Authorization: "Bearer " + localStorage.getItem("auth"),
    },
    method: "POST",
    body: isFormData ? body : JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  // A valid streaming endpoint answers with an event stream. Anything else —
  // e.g. the SPA fallback's index.html from a backend that does not have this
  // route yet — means the request never reached the handler; fail loudly
  // instead of hanging forever with no events.
  const contentType = response.headers.get("Content-Type") || "";
  if (!contentType.includes("text/event-stream")) {
    throw new Error(
      "The server did not start a progress stream. Make sure the backend is running the latest version, then try again.",
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  // becomes true once a terminal event (done/error) arrives; if the stream
  // closes without one, the server went away mid-flight
  let terminated = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE events are separated by a blank line
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop();

    for (const chunk of chunks) {
      let event = "message";
      let data = "";

      for (const line of chunk.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) data += line.slice(5).trim();
      }

      if (data) {
        if (event === "done" || event === "error") terminated = true;
        onEvent(event, data);
      }
    }
  }

  if (!terminated) {
    throw new Error(
      "The connection closed before the lesson finished. Please try again.",
    );
  }
}
