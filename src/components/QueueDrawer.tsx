import { useStore } from "../store";

export function QueueDrawer() {
  const { library, queue, queueIndex, queueOpen, setQueueOpen, moveInQueue, playSongs } =
    useStore();
  if (!queueOpen) return null;
  const byUid = new Map(library.songs.map((s) => [s.uid, s]));

  return (
    <div className="queue-drawer">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <h3 style={{ margin: 0 }}>Queue</h3>
        <button className="ghost" onClick={() => setQueueOpen(false)}>
          Close
        </button>
      </div>
      {queue.map((uid, i) => {
        const s = byUid.get(uid);
        return (
          <div
            key={`${uid}-${i}`}
            className={"list-row" + (i === queueIndex ? " playing" : "")}
            onClick={() => playSongs(queue, i)}
          >
            <span className="muted">{i + 1}</span>
            <div style={{ flex: 1 }}>
              <div>{s?.title ?? uid}</div>
              <div className="muted">{s?.artistNames.join(", ")}</div>
            </div>
            {i > 0 && (
              <button
                className="ghost"
                onClick={(e) => {
                  e.stopPropagation();
                  moveInQueue(i, i - 1);
                }}
              >
                ↑
              </button>
            )}
          </div>
        );
      })}
      {!queue.length && <p className="muted">Queue is empty.</p>}
    </div>
  );
}
