const request = require("supertest");
const server = require("../server");

describe("HTTP 서버 기본 동작", () => {
  it("GET / 요청 시 200과 HTML을 반환한다", async () => {
    const response = await request(server).get("/");

    expect(response.status).toBe(200);
    expect(response.headers["content-type"]).toContain("text/html");
  });

  it("존재하지 않는 경로에 404를 반환한다", async () => {
    const response = await request(server).get("/__not_exists__.html");

    expect(response.status).toBe(404);
    expect(response.text).toContain("404 Not Found");
  });
});

