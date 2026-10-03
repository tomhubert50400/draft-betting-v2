export function connectMatchSocket(queryClient, {
  WebSocketClass = WebSocket,
  location = window.location,
  storage = localStorage,
  schedule = setTimeout,
  cancel = clearTimeout,
} = {}) {
  let socket;
  let retry;
  let disposed = false;
  function connect() {
    if (disposed) return;
    const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
    const token = storage.getItem('token');
    const current = new WebSocketClass(`${protocol}://${location.host}/ws${token ? `?token=${encodeURIComponent(token)}` : ''}`);
    socket = current;
    current.onmessage = (event) => {
      let data;
      try { data = JSON.parse(event.data); } catch { return; }
      if (['match_updated', 'match_created', 'match_deleted'].includes(data?.type)) {
        queryClient.invalidateQueries({ queryKey: ['matches'] });
      }
    };
    current.onclose = () => {
      if (!disposed) retry = schedule(connect, 3000);
    };
    current.onerror = () => current.close();
  }
  connect();
  return () => {
    disposed = true;
    cancel(retry);
    if (socket) {
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.close();
    }
  };
}
