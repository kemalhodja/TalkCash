let web3;
const SALE_CONTRACT = "0x0000000000000000000000000000000000000000";
const TOKEN_RATE = 10000;
const MIN_BNB = 0.01;

async function connectWallet() {
  const statusEl = document.getElementById("status");
  if (!window.ethereum) {
    alert("MetaMask yüklü değil! Lütfen MetaMask kurun.");
    return;
  }

  try {
    const accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
    web3 = new Web3(window.ethereum);
    const short = `${accounts[0].slice(0, 6)}...${accounts[0].slice(-4)}`;
    statusEl.innerText = `Cüzdan bağlandı ✅`;
    const addrEl = document.getElementById("walletAddress");
    if (addrEl) addrEl.innerText = short;
  } catch (error) {
    console.error(error);
    statusEl.innerText = "Cüzdan bağlantısı reddedildi.";
  }
}

async function buyTokens() {
  const statusEl = document.getElementById("status");
  const bnb = parseFloat(document.getElementById("bnbAmount").value);

  if (!web3) {
    alert("Lütfen önce cüzdanınızı bağlayın.");
    return;
  }
  if (!bnb || bnb < MIN_BNB) {
    alert(`Minimum alım miktarı ${MIN_BNB} BNB'dir.`);
    return;
  }

  const accounts = await web3.eth.getAccounts();
  const tokens = bnb * TOKEN_RATE;

  try {
    statusEl.innerText = "İşlem gönderiliyor...";
    await web3.eth.sendTransaction({
      from: accounts[0],
      to: SALE_CONTRACT,
      value: web3.utils.toWei(bnb.toString(), "ether"),
    });
    statusEl.innerText = `Başarılı! ${bnb} BNB karşılığı ~${tokens.toLocaleString()} TALK gönderilecek.`;
  } catch (error) {
    console.error(error);
    statusEl.innerText = "İşlem başarısız veya iptal edildi.";
  }
}

function updatePreview() {
  const bnb = parseFloat(document.getElementById("bnbAmount").value) || 0;
  const preview = document.getElementById("tokenPreview");
  if (preview) {
    preview.innerText = bnb > 0
      ? `≈ ${(bnb * TOKEN_RATE).toLocaleString()} TALK`
      : "";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("bnbAmount");
  if (input) input.addEventListener("input", updatePreview);

  if (window.ethereum) {
    window.ethereum.on("accountsChanged", () => {
      web3 = null;
      const statusEl = document.getElementById("status");
      if (statusEl) statusEl.innerText = "";
      const addrEl = document.getElementById("walletAddress");
      if (addrEl) addrEl.innerText = "";
    });
  }
});
