let currentPage = 0;
let installNode = false;
let installGit = false;
let useGithubIo = true; // username.github.io 사용 여부
let githubUsername = "";

function showPage(n) {
  document.querySelectorAll(".page").forEach((p, i) => {
    p.classList.toggle("active", i === n);
  });
  document.querySelectorAll(".step").forEach((s, i) => {
    s.classList.remove("active", "done");
    if (i < n) s.classList.add("done");
    else if (i === n) s.classList.add("active");
  });
  const backShow = n > 0 && n < 6;
  document.getElementById("backBtn").style.display = backShow ? "inline-block" : "none";
  document.getElementById("nextBtn").style.display = n < 5 ? "inline-block" : "none";
  document.getElementById("nextBtn").disabled = !canGoNext(n);
  document.getElementById("finishBtn").style.display = n === 6 ? "inline-block" : "none";
  currentPage = n;
}

function canGoNext(page) {
  if (page === 0) return true;
  if (page === 1) return document.getElementById("installPath").value.trim().length > 0;
  if (page === 2) return document.getElementById("mainTitle").value.trim().length > 0;
  if (page === 3) return true;
  if (page === 4) return document.getElementById("githubToken").value.trim().length > 0;
  return false;
}

function setProgress(percent, text) {
  const wrap = document.getElementById("progressWrap");
  wrap.classList.add("show");
  document.getElementById("progressBar").style.width = percent + "%";
  document.getElementById("progressText").textContent = text || "설치 중...";
}

// 예/아니오 버튼
function setupOptionButtons(containerId, setValue) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      container.querySelectorAll("button").forEach((b) => b.classList.remove("selected"));
      btn.classList.add("selected");
      setValue(btn.dataset.value === "yes");
    });
  });
}
setupOptionButtons("nodeBtns", (v) => { installNode = v; });
setupOptionButtons("gitBtns", (v) => { installGit = v; });
setupOptionButtons("useGithubIoBtns", (v) => {
  useGithubIo = v;
  const repoInput = document.getElementById("repoName");
  if (repoInput) {
    if (v && githubUsername) {
      repoInput.value = githubUsername + ".github.io";
      repoInput.readOnly = true;
    } else {
      repoInput.readOnly = false;
      if (repoInput.value === githubUsername + ".github.io") repoInput.value = "my-photo-site";
    }
  }
});

// 경로·사이트 이름·토큰 입력 시 다음 버튼 활성화
document.getElementById("installPath").addEventListener("input", () => {
  if (currentPage === 1) document.getElementById("nextBtn").disabled = !canGoNext(1);
});
document.getElementById("installPath").addEventListener("change", () => {
  if (currentPage === 1) document.getElementById("nextBtn").disabled = !canGoNext(1);
});
document.getElementById("mainTitle").addEventListener("input", () => {
  if (currentPage === 2) document.getElementById("nextBtn").disabled = !canGoNext(2);
});
document.getElementById("githubToken").addEventListener("input", () => {
  if (currentPage === 4) document.getElementById("nextBtn").disabled = !canGoNext(4);
});

// 토큰 발급 링크
document.getElementById("openTokenUrl").addEventListener("click", () => {
  if (window.installerAPI && window.installerAPI.openGitHubTokenUrl) {
    window.installerAPI.openGitHubTokenUrl();
  } else {
    window.open("https://github.com/settings/tokens/new?scopes=repo&description=PhotoSite-Installer", "_blank");
  }
});

// 토큰 확인 (GitHub 사용자 조회) - 다음 클릭 시 자동으로 확인하거나, 별도 버튼으로
async function verifyToken() {
  const token = document.getElementById("githubToken").value.trim();
  if (!token) return null;
  try {
    const user = await window.installerAPI.githubGetUser(token);
    if (user && user.login) {
      githubUsername = user.login;
      const wrap = document.getElementById("githubUserWrap");
      const el = document.getElementById("githubUser");
      if (wrap) wrap.style.display = "block";
      if (el) el.textContent = user.login + " (GitHub 연동됨)";
      const repoInput = document.getElementById("repoName");
      if (useGithubIo && repoInput) {
        repoInput.value = githubUsername + ".github.io";
        repoInput.readOnly = true;
      }
      return user;
    }
  } catch (e) {
    console.warn("GitHub token verify failed", e);
  }
  return null;
}

document.getElementById("nextBtn").addEventListener("click", async () => {
  if (currentPage === 0) {
    showPage(1);
    window.installerAPI.getDefaultPath().then((p) => {
      const input = document.getElementById("installPath");
      if (input && !input.value) input.value = p || "";
      document.getElementById("nextBtn").disabled = !canGoNext(1);
    }).catch(() => {});
    return;
  }
  if (currentPage === 1) {
    const path = document.getElementById("installPath").value.trim();
    if (!path) return;
    showPage(2);
    document.getElementById("nextBtn").disabled = !canGoNext(2);
    return;
  }
  if (currentPage === 2) {
    if (!document.getElementById("mainTitle").value.trim()) return;
    showPage(3);
    return;
  }
  if (currentPage === 3) {
    showPage(4);
    document.getElementById("nextBtn").disabled = !canGoNext(4);
    // 토큰이 있으면 자동으로 사용자 확인
    const token = document.getElementById("githubToken").value.trim();
    if (token) verifyToken().catch(() => {});
    return;
  }
  if (currentPage === 4) {
    const token = document.getElementById("githubToken").value.trim();
    if (!token) return;
    const user = await verifyToken();
    if (!user) {
      alert("토큰이 올바르지 않거나 만료되었습니다. GitHub에서 새 토큰을 발급한 뒤 다시 시도하세요.");
      return;
    }
    showPage(5);
    setProgress(5, "준비 중...");
    const installPath = document.getElementById("installPath").value.trim();
    const mainTitle = document.getElementById("mainTitle").value.trim() || "MY PHOTOGRAPHY";
    const subtitle = document.getElementById("subtitle").value.trim() || "Photography";
    let repoName = document.getElementById("repoName").value.trim() || "my-photo-site";
    if (useGithubIo && githubUsername) repoName = githubUsername + ".github.io";
    try {
      if (installNode) {
        setProgress(10, "Node.js 설치 중...");
        await window.installerAPI.installNode();
      }
      if (installGit) {
        setProgress(35, "Git 설치 중...");
        await window.installerAPI.installGit();
      }
      setProgress(50, "파일 복사 및 GitHub 설정 중...");
      const result = await window.installerAPI.doInstall({
        installPath,
        mainTitle,
        subtitle,
        githubToken: token,
        repoName,
        useGithubIo,
      });
      setProgress(95, "첫 푸시 및 Pages 설정 중...");
      if (result && result.ok) {
        setProgress(100, "완료");
        document.getElementById("finishPath").textContent = "설치 경로: " + result.path;
        const siteUrlEl = document.getElementById("finishSiteUrl");
        if (result.siteUrl && siteUrlEl) siteUrlEl.textContent = "사이트 주소: " + result.siteUrl;
        showPage(6);
      } else {
        alert(result && result.error ? result.error : "설치 중 오류가 났습니다.");
        showPage(4);
      }
    } catch (err) {
      alert("설치 실패: " + (err.message || err));
      showPage(4);
    }
    return;
  }
});

document.getElementById("backBtn").addEventListener("click", () => {
  if (currentPage > 0 && currentPage < 6) {
    showPage(currentPage - 1);
    document.getElementById("nextBtn").disabled = !canGoNext(currentPage - 1);
  }
});

document.getElementById("finishBtn").addEventListener("click", () => {
  if (window.installerAPI && window.installerAPI.quit) window.installerAPI.quit();
});

document.getElementById("browseBtn").addEventListener("click", async () => {
  const dir = await window.installerAPI.selectDir();
  if (dir) {
    document.getElementById("installPath").value = dir;
    document.getElementById("nextBtn").disabled = false;
  }
});

showPage(0);

window.addEventListener("beforeunload", () => {
  if (window.installerAPI && window.installerAPI.cleanupRunningProcesses) {
    window.installerAPI.cleanupRunningProcesses().catch(() => {});
  }
});
