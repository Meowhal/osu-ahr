import http from "http";
import io from "socket.io";
import fs from "fs";
export function SocketTrial() {
  console.log("create server ");
  const x = http.createServer((req, res) => {
    res.writeHead(200, { "Content-Type": "text/html" });
    var output = fs.readFileSync("./src/trials/index.html", "utf-8");
    res.end(output);
  }).listen(8080);
  const s = io.listen();
  s.sockets.on("connection", socket => {
    // メッセージ送信（送信者にも送られる）
    socket.on("C_to_S_message", function (data) {
      s.sockets.emit("S_to_C_message", { value: data.value });
    });

    // ブロードキャスト（送信者以外の全員に送信）
    socket.on("C_to_S_broadcast", function (data) {
      socket.broadcast.emit("S_to_C_message", { value: data.value });
    });

    // 切断したときに送信
    socket.on("disconnect", function () {
      //    io.sockets.emit("S_to_C_message", {value:"user disconnected"});
    });
  });
}

