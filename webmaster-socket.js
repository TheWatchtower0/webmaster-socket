import url from "url";
import { WebSocketServer } from "ws";

const webSocketSecure = new WebSocketServer({
   port: process.env.PORT || 8080
});

const BACKEND_URL = "https://fdd.thewatchtower.ae/api/v1";

/**
 * @type {Map<string, WebSocket>}
 */
const clients = new Map();
/**
 * @type {Map<string, WebSocket>}
 */
const deviceMap = new Map();

webSocketSecure.on("connection", async (webSocket, request) => {
  const { deviceId, userId } = url.parse(request.url, true).query;

  webSocket.deviceId = deviceId;
  webSocket.userId = userId;

  clients.set(userId, webSocket);
  deviceMap.set(deviceId, webSocket);

  webSocket.on("message", async (data) => {
    const json = JSON.parse(Buffer.from(data).toString());

    switch (json.type) {
      case "send_message":
        {
          const payload = {
            ...json,
            type: "message_sent",
            message: json.message,
            read: false,
            message_id: json.message_id,
            conversation_id: json.conversation_id,
            sender_id: json.sender_id,
            time: json.time,
            deviceId: webSocket.deviceId,
            ...(json.reply && { reply: json.reply }),
            ...(json.files && { files: json.files }),
          };

          const response = await fetch(`${BACKEND_URL}/messages/send`, {
            method: "POST",
            body: JSON.stringify({
              message_id: payload.message_id,
              conversation_id: payload.conversation_id,
              message: payload.message,
              sender_id: payload.sender_id,
              time: payload.time,
              ...(payload.reply && { parent_id: payload.reply.id }),
              ...(payload.files && { file: payload.files }),
            }),
            headers: {
              "content-type": "application/json",
            },
          });

          const data = await response.json();

          const involvedSockets = [
            clients.get(data.data.conversation_user_id.toString()),
            clients.get(data.data.conversation_admin_id.toString()),
          ];

          involvedSockets.forEach((socket) => {
            socket && socket.readyState === socket.OPEN &&
              socket?.send(JSON.stringify(payload));
          });
        }
        break;
      case "delivered_message":
        {
          const payload = {
            type: "message_delivered",
            message_id: json.message_id,
            conversation_id: json.conversation_id,
            sender_id: json.sender_id,
            deviceId: webSocket.deviceId,
          };

          const response = await fetch(`${BACKEND_URL}/messages/delivered`, {
            method: "POST",
            body: JSON.stringify({
              message_id: payload.message_id,
              conversation_id: payload.conversation_id,
              sender_id: payload.sender_id,
            }),
            headers: {
              "content-type": "application/json",
            },
          });

          const data = await response.json();

          const involvedSockets = [
            clients.get(data.data.conversation_user_id.toString()),
            clients.get(data.data.conversation_admin_id.toString()),
          ];

          involvedSockets.forEach((socket) => {
            socket && socket.readyState === socket.OPEN &&
              socket?.send(JSON.stringify(payload));
          });
        }
        break;
      case "read_message":
        {
          const payload = {
            type: "message_read",
            conversation_id: json.conversation_id,
            sender_id: json.sender_id,
            deviceId: webSocket.deviceId,
          };

          const response = await fetch(`${BACKEND_URL}/messages/read-all`, {
            method: "POST",
            body: JSON.stringify({
              conversation_id: payload.conversation_id,
              sender_id: payload.sender_id,
            }),
            headers: {
              "content-type": "application/json",
            },
          });

          const data = await response.json();

           console.log(data)

          const involvedSockets = [
            clients.get(data.data.conversation_user_id.toString()),
            clients.get(data.data.conversation_admin_id.toString()),
          ];
            
          involvedSockets.forEach((socket) => {
             console.log(socket, 'socket')
            socket && socket && socket.readyState === socket.OPEN &&
              socket?.send(JSON.stringify(payload));
          });
        }
        break;
      case "focus":
      case "active-typing":
      case "idle-typing":
      case "blur":
        {
          const payload = {
            type: json.type,
            conversation_id: json.conversation_id,
            sender_id: json.sender_id,
            deviceId: webSocket.deviceId,
          };

          const response = await fetch(
            `${BACKEND_URL}/messages/conversation/${json.conversation_id}`,
            {
              method: "GET",
              headers: {
                "content-type": "application/json",
              },
            }
          );

          const data = await response.json();
          const involvedSockets = [
            clients.get(data.data.conversation_user_id.toString()),
            clients.get(data.data.conversation_admin_id.toString()),
          ];

          involvedSockets.forEach((socket) => {
            socket && socket && socket.readyState === socket.OPEN &&
              socket?.send(JSON.stringify(payload));
          });
        }
        break;
      case "edit_message":
        {
          const payload = {
            type: "edit_message",
            message: json.message,
            message_id: json.message_id,
            conversation_id: json.conversation_id,
            sender_id: json.sender_id,
            deviceId: webSocket.deviceId,
          };

          const response = await fetch(`${BACKEND_URL}/messages/update`, {
            method: "POST",
            body: JSON.stringify({
              message: payload.message,
              message_id: payload.message,
            }),
            headers: {
              "content-type": "application/json",
            },
          });

          const data = await response.json();

          const involvedSockets = [
            clients.get(data.data.conversation_user_id.toString()),
            clients.get(data.data.conversation_admin_id.toString()),
          ];

          involvedSockets.forEach((socket) => {
            socket && socket.readyState === socket.OPEN &&
              socket?.send(JSON.stringify(payload));
          });
        }
        break;
      case "delete_message":
        {
          const payload = {
            type: "delete_message",
            message_id: json.message_id,
            deviceId: webSocket.deviceId,
          };

          const response = await fetch(`${BACKEND_URL}/messages/delete`, {
            method: "POST",
            body: JSON.stringify({
              message_id: payload.message,
            }),
            headers: {
              "content-type": "application/json",
            },
          });

          const data = await response.json();

          const involvedSockets = [
            clients.get(data.data.conversation_user_id.toString()),
            clients.get(data.data.conversation_admin_id.toString()),
          ];

          involvedSockets.forEach((socket) => {
            socket && socket.readyState === socket.OPEN &&
              socket?.send(JSON.stringify(payload));
          });
        }
        break;
      default:
        break;
    }
  });
});

console.log('Webmaster socket server is running')
