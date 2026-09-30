const server = require("./server.js");
const { exec } = require("child_process");
const os = require("os");

const PORT = process.env.PORT || 3000;
// 0.0.0.0으로 설정하면 모든 네트워크 인터페이스에서 접속 가능
const HOST = "0.0.0.0";

// 로컬 IP 주소 가져오기
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // IPv4이고 내부 주소가 아닌 경우
      if (iface.family === "IPv4" && !iface.internal) {
        return iface.address;
      }
    }
  }
  return "127.0.0.1";
}

server.on("error", (err) => {
  console.error("❌ 서버 오류:", err.message);
  if (err.code === "EADDRINUSE") {
    console.error(`   포트 ${PORT}이(가) 이미 사용 중입니다. 다른 포트를 쓰거나 해당 프로그램을 종료하세요.`);
  }
  process.exit(1);
});

server.listen(PORT, HOST, () => {
  const localIP = getLocalIP();
  console.log(`✅ 서버 실행 중:`);
  console.log(`   로컬: http://127.0.0.1:${PORT}`);
  console.log(`   네트워크: http://${localIP}:${PORT}`);
  console.log(`   모바일에서 접속: 같은 Wi-Fi에 연결 후 http://${localIP}:${PORT} 접속`);
  console.log(`   (이 창은 닫지 마세요)`);
  
  // Windows에서 브라우저 자동 열기
  const url = `http://127.0.0.1:${PORT}`;
  const command = process.platform === "win32" 
    ? `start ${url}` 
    : process.platform === "darwin" 
    ? `open ${url}` 
    : `xdg-open ${url}`;
  
  exec(command, (error) => {
    if (error) {
      console.log(`   브라우저를 자동으로 열 수 없습니다. 수동으로 ${url} 을 열어주세요.`);
    }
  });
});



