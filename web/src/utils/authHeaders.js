export const authHeaders = (contentType = "application/json") => {
  const headers = {
    Authorization: "Bearer " + localStorage.getItem("auth"),
  };
  if (contentType) {
    headers["Content-Type"] = contentType;
  }
  return headers;
};
