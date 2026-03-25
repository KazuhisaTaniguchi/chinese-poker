const SAVE_KEY = 'ofc-poker-save';

export function useSave() {
  const saveGame = (state) => {
    try {
      const serializable = JSON.stringify(state);
      localStorage.setItem(SAVE_KEY, serializable);
    } catch (e) {
      console.error('セーブ失敗:', e);
    }
  };

  const loadGame = () => {
    try {
      const saved = localStorage.getItem(SAVE_KEY);
      if (!saved) return null;
      const parsed = JSON.parse(saved);
      // 基本的な検証
      if (!parsed.players || !parsed.phase) return null;
      return parsed;
    } catch (e) {
      console.error('ロード失敗:', e);
      return null;
    }
  };

  const hasSave = () => {
    try {
      return localStorage.getItem(SAVE_KEY) !== null;
    } catch {
      return false;
    }
  };

  const clearSave = () => {
    try {
      localStorage.removeItem(SAVE_KEY);
    } catch (e) {
      console.error('セーブ削除失敗:', e);
    }
  };

  return { saveGame, loadGame, hasSave, clearSave };
}
