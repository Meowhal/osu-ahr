/**
 * 延期可能な遅延実行アクションを表現するクラス。
 */
export class DeferredAction<T> {
  /** actionに渡されるパラメタ */
  param: T | undefined;
  /** 遅延実行される関数 */
  action: (p: T) => void;
  private timeId: NodeJS.Timeout | null = null;
  constructor(action: (p: T) => void) {
    this.action = action;
  }

  /**
   * アクションの遅延実行を開始する
   * @param delay 遅延時間 ms
   * @param param アクションに渡されるパラメータ
   * @param resetTimer 現在の遅延時間をリセットするか
   */
  start(delay: number, param: T | undefined = undefined, resetTimer: boolean = false) {
    if (this.timeId !== null && resetTimer) {
      clearTimeout(this.timeId);
      this.timeId = null;
    }
    this.param = param;
    if (this.timeId === null) {
      this.timeId = setTimeout(() => {
        this.timeId = null;
        this.action(this.param as T);
        this.param = undefined;
      }, delay);
      this.timeId.unref();
    }
  }

  /** 遅延実行をキャンセルする。*/
  cancel(): void {
    if (this.timeId !== null) {
      clearTimeout(this.timeId);
      this.timeId = null;
      this.param = undefined;
    }
  }

  /** 遅延実行が完了しているか */
  get done(): boolean {
    return this.timeId === null;
  }
}