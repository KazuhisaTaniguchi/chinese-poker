import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * ドラッグ＆ドロップ フック (タッチ + マウス対応)
 * - 手札カード → ボード列 : カード配置
 * - ボードカード → 手札エリア : 元に戻す
 */
export default function useDragDrop({ onPlaceCard, onUndoRow, onMoveCard }) {
  const [dragging, setDragging] = useState(null); // { card, source: 'hand'|'board', row? }
  const ghostRef = useRef(null);
  const startPos = useRef({ x: 0, y: 0 });
  const hasMoved = useRef(false);

  // ゴーストを作成
  const createGhost = useCallback((card, x, y) => {
    const ghost = document.createElement('div');
    ghost.className = 'drag-ghost';
    ghost.innerHTML = `<span>${card.rank}</span><span>${card.suit}</span>`;
    ghost.style.left = `${x}px`;
    ghost.style.top = `${y}px`;
    document.body.appendChild(ghost);
    ghostRef.current = ghost;
  }, []);

  // ゴーストを移動
  const moveGhost = useCallback((x, y) => {
    if (ghostRef.current) {
      ghostRef.current.style.left = `${x}px`;
      ghostRef.current.style.top = `${y}px`;
    }
  }, []);

  // ゴーストを削除
  const removeGhost = useCallback(() => {
    if (ghostRef.current) {
      ghostRef.current.remove();
      ghostRef.current = null;
    }
  }, []);

  // ドロップターゲットを検出
  const findDropTarget = useCallback((x, y) => {
    removeGhost(); // ゴーストを一時非表示にして下の要素を検出
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const target = el.closest('[data-drop-target]');
    return target ? (target as HTMLElement).dataset.dropTarget : null;
  }, [removeGhost]);

  // ドラッグ開始 (手札カード)
  const handleHandDragStart = useCallback((card, e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    startPos.current = { x: clientX, y: clientY };
    hasMoved.current = false;
    setDragging({ card, source: 'hand' });
    // ゴーストはmoveで距離判定後に作成
  }, []);

  // ドラッグ開始 (ボードカード)
  const handleBoardDragStart = useCallback((card, row, e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    startPos.current = { x: clientX, y: clientY };
    hasMoved.current = false;
    setDragging({ card, source: 'board', row });
  }, []);

  // グローバルmove/upハンドラ
  useEffect(() => {
    if (!dragging) return;

    const handleMove = (e) => {
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      const dx = clientX - startPos.current.x;
      const dy = clientY - startPos.current.y;

      if (!hasMoved.current && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        hasMoved.current = true;
        createGhost(dragging.card, clientX, clientY);
        if (e.cancelable) e.preventDefault();
      }

      if (hasMoved.current) {
        moveGhost(clientX, clientY);
        if (e.cancelable) e.preventDefault();

        // ハイライト表示
        document.querySelectorAll('[data-drop-target]').forEach(el => {
          const rect = el.getBoundingClientRect();
          const isOver = clientX >= rect.left && clientX <= rect.right &&
                         clientY >= rect.top && clientY <= rect.bottom;
          el.classList.toggle('drop-highlight', isOver);
        });
      }
    };

    const handleEnd = (e) => {
      const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
      const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;

      document.querySelectorAll('.drop-highlight').forEach(el => {
        el.classList.remove('drop-highlight');
      });

      if (hasMoved.current) {
        const target = findDropTarget(clientX, clientY);

        if (dragging.source === 'hand' && target && target !== 'hand') {
          // 手札 → ボード列
          onPlaceCard(dragging.card, target);
        } else if (dragging.source === 'board' && target === 'hand') {
          // ボード → 手札 (undo)
          onUndoRow(dragging.row);
        } else if (dragging.source === 'board' && target && target !== 'hand' && target !== dragging.row) {
          // ボード → 別のボード列 (移動)
          onMoveCard(dragging.card, dragging.row, target);
        }
      }

      removeGhost();
      setDragging(null);
    };

    document.addEventListener('touchmove', handleMove, { passive: false });
    document.addEventListener('mousemove', handleMove);
    document.addEventListener('touchend', handleEnd);
    document.addEventListener('mouseup', handleEnd);

    return () => {
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('touchend', handleEnd);
      document.removeEventListener('mouseup', handleEnd);
    };
  }, [dragging, createGhost, moveGhost, removeGhost, findDropTarget, onPlaceCard, onUndoRow]);

  return {
    dragging,
    handleHandDragStart,
    handleBoardDragStart,
  };
}
