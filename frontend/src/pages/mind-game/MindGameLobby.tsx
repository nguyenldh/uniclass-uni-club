import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  TreasurePopup,
  GameButton,
  GameCanvas,
  Banner,
} from "../../design-system/game";
import { CaroO, CaroX, MemoryFlipDemo } from "../../design-system";
import { useUser } from "../../hooks/useUser";
import { ExitButton } from "../../components";

export function MindGameLobby() {
  const navigate = useNavigate();
  const { error: userError } = useUser();

  useEffect(() => {
    if (userError) {
      navigate("/error", { state: { message: userError }, replace: true });
    }
  }, [userError, navigate]);

  return (
    <GameCanvas
      className="mind-game-lobby"
      style={{
        paddingTop: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
      }}
    >
      <ExitButton from="/mind-game" />
      <Banner variant="brown" className="lobby-header">
        <h1>Đấu Trí</h1>
      </Banner>

      <div className="lobby-games">
        <TreasurePopup
          ribbon={"Lật thẻ"}
          title={
            <div
              style={{
                display: "flex",
                justifyContent: "center",
                marginBottom: 12,
              }}
            >
              <MemoryFlipDemo content="🃏" cardSize={80} stepDelay={800} />
            </div>
          }
          subtitle="Thi đấu lật thẻ với người chơi khác. Ai tìm được nhiều cặp hơn sẽ thắng!"
          actions={
            <div style={{ display: "flex", gap: 12, justifyContent: "center" }}>
              <GameButton
                color="orange"
                onClick={() => navigate("/matchmaking/card_flip")}
              >
                Chơi Ngay
              </GameButton>
            </div>
          }
        />

        <TreasurePopup
          ribbon="Cờ Caro"
          title={
            <div style={{ width: 200, margin: "auto", display: "flex" }}>
              <CaroX size={8} />
              <CaroO size={8} />
            </div>
          }
          subtitle="Đấu trí chiến thuật với người hoặc máy. Điền 5 quân liên tiếp để thắng!"
          actions={
            <GameButton
              color="orange"
              onClick={() => navigate("/matchmaking/gomoku")}
            >
              Chơi Ngay
            </GameButton>
          }
        />
      </div>


    </GameCanvas>
  );
}
