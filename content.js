// コンテンツスクリプト - Webページ上で実行される
console.log("Chrome拡張機能のコンテンツスクリプトが読み込まれました");

// 対象URLのチェック
const currentHostname = window.location.hostname;
const currentPathname = window.location.pathname;

// 対象サイトかどうかをチェック
const isTargetSite =
  currentHostname.includes("parasol.anser.ne.jp") &&
  (currentPathname.includes("BLI001Dispatch") ||
    currentPathname.includes("ib/"));

// 初期化処理を実行
initializeContentScriptIfTarget();

// 対象サイトの場合のみ初期化を実行する関数
function initializeContentScriptIfTarget() {
  if (!isTargetSite) {
    console.log("対象外のURLです:", window.location.href);
    return;
  }

  console.log("対象サイトでコンテンツスクリプトが実行されます");

  // ページの読み込み完了を待つ
  document.addEventListener("DOMContentLoaded", () => {
    console.log("DOMContentLoaded - 初期化を実行");
    initializeContentScript();
  });

  // document.bodyが利用可能になった時点で初期化を実行
  if (document.readyState === "loading") {
    // まだ読み込み中の場合はDOMContentLoadedを待つ
    console.log("ページ読み込み中 - DOMContentLoadedを待機");
  } else {
    // 既に読み込み完了している場合は即座に実行
    console.log("ページ読み込み完了 - 即座に初期化を実行");
    initializeContentScript();
  }
}

// コンテンツスクリプトの初期化
function initializeContentScript() {
  try {
    // メッセージリスナーの設定
    setupMessageListener();

    // 対象サイト特有の処理
    handleTargetSiteFeatures();
  } catch (error) {
    console.error("コンテンツスクリプトの初期化中にエラーが発生:", error);
  }
}

// 対象サイト特有の機能
function handleTargetSiteFeatures() {
  // 桁数抽出機能の初期化
  initializeDigitExtraction();
}

// 桁数抽出機能の初期化
function initializeDigitExtraction() {
  // ページの内容が確実に読み込まれた後に桁数抽出を実行
  if (document.readyState === "complete") {
    // ページが完全に読み込まれている場合は即座に実行
    executeDigitExtraction();
  } else {
    // まだ読み込み中の場合はloadイベントを待つ
    window.addEventListener("load", () => {
      console.log("ページ完全読み込み完了 - 桁数抽出を実行");
      executeDigitExtraction();
    });
  }
}

// 桁数抽出の実行
function executeDigitExtraction() {
  // ページから桁数を抽出
  const extractedDigits = extractDigitsFromPage();

  if (extractedDigits.length > 0) {
    // アクティブな入力フォームにペーストする機能を追加
    setupActiveFormPaste(extractedDigits);
  }
}

// アクティブな入力フォームにペーストする機能を設定
function setupActiveFormPaste(digits) {
  // グローバル変数に保存（他の関数からアクセス可能）
  window.extensionDigits = digits;

  // フォーカスイベントを監視
  document.addEventListener("focusin", (event) => {
    const target = event.target;
    if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") {
      // アクティブな要素を保存
      window.activeInputElement = target;
    }
  });

  // フォーカスアウトイベントを監視
  document.addEventListener("focusout", (event) => {
    const target = event.target;
    if (target === window.activeInputElement) {
      window.activeInputElement = null;
    }
  });
}

// ページから桁数を抽出
function extractDigitsFromPage() {
  const digits = [];

  // document.bodyが存在するかチェック
  if (!document.body) {
    console.log("document.bodyがまだ利用できません");
    return digits;
  }

  // ページ全体のテキストを取得
  const pageText = document.body.innerText;

  // 正規表現で桁数を検索
  const digitPattern = /(\d+)桁目/g;
  let match;

  while ((match = digitPattern.exec(pageText)) !== null) {
    const digit = parseInt(match[1]);
    if (!digits.includes(digit)) {
      digits.push(digit);
    }
  }

  console.log("ページから抽出された桁数:", digits);
  return digits;
}

// メッセージリスナーの設定
function setupMessageListener() {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    try {
      if (message.action === "extractDigits") {
        // 桁数抽出のメッセージ
        const digits = extractDigitsFromPage();
        sendResponse({ success: true, digits: digits });
      } else if (message.action === "pasteToActiveForm") {
        // アクティブな入力フォームにペースト
        pasteToActiveForm().then((result) => {
          sendResponse({ success: true, result: result });
        });
        return true; // 非同期レスポンスを示す
      } else {
        sendResponse({ success: false, error: "Unknown action" });
      }
    } catch (error) {
      console.error("メッセージ処理中にエラーが発生:", error);
      sendResponse({ success: false, error: error.message });
    }
  });
}

// アクティブな入力フォームにペースト
function pasteToActiveForm() {
  // アクティブな入力要素を確認
  const activeElement = document.activeElement;
  const activeInput = window.activeInputElement || activeElement;

  // 入力フォームかどうかをチェック
  if (
    !activeInput ||
    (activeInput.tagName !== "INPUT" && activeInput.tagName !== "TEXTAREA")
  ) {
    return Promise.resolve({
      success: false,
      message: "アクティブな入力フォームが見つかりません",
    });
  }

  // 利用者番号を取得
  return new Promise((resolve) => {
    chrome.storage.sync.get(["userNumber"], async (result) => {
      const userNumber = result.userNumber || "";

      if (!userNumber) {
        resolve({ success: false, message: "利用者番号が設定されていません" });
        return;
      }

      // 桁数が設定されているかチェック
      if (!window.extensionDigits || window.extensionDigits.length === 0) {
        resolve({ success: false, message: "抽出された桁数がありません" });
        return;
      }

      // 対応する文字を取得（最初の4文字のみ）
      const correspondingChars = [];
      const maxDigits = 4; // 最大4文字まで

      for (
        let i = 0;
        i < Math.min(window.extensionDigits.length, maxDigits);
        i++
      ) {
        const digit = window.extensionDigits[i];
        if (digit <= userNumber.length) {
          const char = userNumber[digit - 1]; // 0ベースなので-1
          correspondingChars.push(char);
        } else {
          correspondingChars.push(""); // 桁数不足の場合は空文字
        }
      }

      const textToPaste = correspondingChars.join("");

      try {
        // 入力フォームに値を設定
        activeInput.value = textToPaste;

        // 入力イベントを発火
        const inputEvent = new Event("input", { bubbles: true });
        activeInput.dispatchEvent(inputEvent);

        // 変更イベントを発火
        const changeEvent = new Event("change", { bubbles: true });
        activeInput.dispatchEvent(changeEvent);

        resolve({ success: true, message: "ペースト完了", text: textToPaste });
      } catch (error) {
        resolve({
          success: false,
          message: "ペースト中にエラーが発生しました",
          error: error.message,
        });
      }
    });
  });
}

// ページの読み込み状態を監視
window.addEventListener("load", () => {
  console.log("ページの完全な読み込みが完了しました");
});

// ページのアンロード時の処理
window.addEventListener("beforeunload", () => {
  console.log("ページがアンロードされます");
  // クリーンアップ処理があればここで実行
});
