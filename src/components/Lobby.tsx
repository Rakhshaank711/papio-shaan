import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const randomRoomId = () => Math.random().toString(36).slice(2, 8);

export function Lobby() {
  const navigate = useNavigate();
  const [roomIdInput, setRoomIdInput] = useState('');
  const suggested = useMemo(randomRoomId, []);

  const goToRoom = (id: string) => {
    if (!id) return;
    navigate(`/room/${id}`);
  };

  return (
    <div className="panel">
      <header className="header">
        <div>
          <p className="eyebrow">Paper-style multiplayer</p>
          <h1>Territory Clash</h1>
          <p className="muted">
            Join a room, stake virtual coins, and carve up the grid. Host keeps the loop; Supabase
            keeps everyone in sync.
          </p>
        </div>
      </header>
      <div className="card-grid">
        <div className="card">
          <h2>Create room</h2>
          <p className="muted">Spin up a new room and share the link with friends.</p>
          <div className="inline-actions">
            <code className="pill">room_{suggested}</code>
            <button onClick={() => goToRoom(suggested)}>Create &amp; enter</button>
          </div>
        </div>
        <div className="card">
          <h2>Join room</h2>
          <p className="muted">Paste a room ID you received.</p>
          <div className="inline-actions">
            <input
              className="input"
              placeholder="room id"
              value={roomIdInput}
              onChange={(e) => setRoomIdInput(e.target.value.trim())}
            />
            <button disabled={!roomIdInput} onClick={() => goToRoom(roomIdInput)}>
              Join
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Lobby;
