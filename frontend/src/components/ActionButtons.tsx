

export default function ActionButtons({ onConfirm, onUndo, canConfirm, hasPlacedCards, selectedCard, isDiscardMode, discardCount }) {
  const getButtonText = () => {
    if (isDiscardMode) {
      return discardCount > 1 ? `${discardCount}枚捨てて確定` : '捨てて確定';
    }
    if (canConfirm) return '確定する';
    if (selectedCard) return '列をタップ';
    return 'カードを選択';
  };

  return (
    <div className="action-bar">
      <button
        className="btn btn-secondary"
        onClick={onUndo}
        disabled={!hasPlacedCards}
        id="undo-btn"
      >
        元に戻す
      </button>
      <button
        className={`btn ${isDiscardMode ? 'btn-discard' : 'btn-primary'}`}
        onClick={onConfirm}
        disabled={!canConfirm}
        id="confirm-btn"
      >
        {getButtonText()}
      </button>
    </div>
  );
}
