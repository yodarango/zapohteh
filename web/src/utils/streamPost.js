/* *************************************************************************************************
 * Posts a JSON body to an endpoint and reads back a Server-Sent Events stream. For every event
 * received it calls onEvent with the parsed event name and its raw data string. This is used to
 * report long running progress (such as a research being built chapter by chapter) to the UI.
 * *************************************************************************************************
 */
export async function streamPost(props) {
  const { url, body, onEvent, options = {} } = props;

  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
      Authorization: "Bearer " + localStorage.getItem("auth"),
    },
    method: "POST",
    body: JSON.stringify(body),
  });

  if (!response.ok || !response.body) {
    throw new Error(`HTTP error! Status: ${response.status}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

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

      if (data) onEvent(event, data);
    }
  }
}
