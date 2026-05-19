// =====================
// canvas取得
// =====================
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

function resizeCanvas(){
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

const TILE = 32;

let mapData = [];
let blocks = [];
let currentMap = "";
let currentEvents = {};
let currentTileTypes = {};
let mapWidth = 0;
let mapHeight = 0;

let cameraX = 0;
let cameraY = 0;

// =====================
// BGM
// =====================
let currentBGM = null;

function playBGM(src){
  if(currentBGM){
    currentBGM.pause();
    currentBGM = null;
  }
  const audio = new Audio(src);
  audio.loop = true;
  audio.volume = 0.5;
  audio.play().catch(()=>{});
  currentBGM = audio;
}

// =====================
// フェード
// =====================
let fadeAlpha = 0;
let isFading = false;
let fadeMode = null;
let fadeCallback = null;

function startFade(callback){
  isFading = true;
  fadeMode = "out";
  fadeAlpha = 0;
  fadeCallback = callback;
}

// =====================
// マップ名表示
// =====================
let mapTitle = "";
let mapTitleTimer = 0;
let mapTitleAlpha = 0;

// =====================
// 画像
// =====================
const images = {};
function loadImage(name, src){
  const img = new Image();
  img.src = src;
  images[name] = img;
}
loadImage("desk", "desk.png");
loadImage("window", "window.png");

// =====================
// プレイヤー
// =====================
const player = {
  x: 0,
  y: 0,
  size: TILE,
  color: "blue"
};

let targetX = 0;
let targetY = 0;
let isMoving = false;
const moveSpeed = 8;

// =====================
// コメント表示システム（下部UI・最適版）
// =====================
let isTalking = false;
const messageBox = document.getElementById("messageBox");

let messageLines = [];
let messageIndex = 0;
let charIndex = 0;
let isTyping = false;
let fullMessage = "";

// コメント開始（イベントから呼ばれる）
function startTalk(lines){
  if(isTalking || !lines) return;

  isTalking = true;
  messageBox.style.display = "flex";

  messageLines = lines;
  messageIndex = 0;
  nextMessage();
}

// タイプ演出
function typeMessage(text){
  isTyping = true;
  fullMessage = text;
  charIndex = 0;
  messageBox.innerHTML = "";
  typeWriter();
}

function typeWriter(){
  if(charIndex < fullMessage.length){
    messageBox.innerHTML += fullMessage[charIndex];
    charIndex++;
    setTimeout(typeWriter, 30); // 速度調整可
  }else{
    isTyping = false;
  }
}

// 次の文章
function nextMessage(){
  if(isTyping){
    messageBox.innerHTML = fullMessage;
    isTyping = false;
    return;
  }

  if(messageIndex >= messageLines.length){
    endTalk();
    return;
  }

  typeMessage(messageLines[messageIndex]);
  messageIndex++;
}

// 終了
function endTalk(){
  isTalking = false;
  messageBox.style.display = "none";
  messageBox.innerHTML = "";
}

// =====================
// マップ読み込み
// =====================
function loadMap(name, customSpawn=null){
  fetch("./" + name + ".json")
    .then(res => res.json())
    .then(data => {

      currentMap = name;
      mapData = data.tiles;
      currentEvents = data.events || {};
      currentTileTypes = data.tileTypes || {};

      mapWidth = mapData[0].length * TILE;
      mapHeight = mapData.length * TILE;

      if(customSpawn){
        player.x = customSpawn.x;
        player.y = customSpawn.y;
      } else if(data.spawn){
        player.x = data.spawn.x;
        player.y = data.spawn.y;
      }

      targetX = player.x;
      targetY = player.y;

      createMap();

      if(data.bgm){
        playBGM(data.bgm);
      }

      if(data.mapName){
        mapTitle = data.mapName;
        mapTitleTimer = 180;
        mapTitleAlpha = 0;
      }
    })
    .catch(err=>{
      console.error("マップ読み込み失敗:", err);
    });
}

loadMap("map");

// =====================
// マップ生成
// =====================
function createMap(){
  blocks = [];
  for(let row=0; row<mapData.length; row++){
    for(let col=0; col<mapData[row].length; col++){
      const tile = mapData[row][col];
      const x = col * TILE;
      const y = row * TILE;
      const type = currentTileTypes[tile];

      if(type){
        blocks.push({
          x,y,
          size:TILE,
          solid:type.solid || false,
          image:type.image || null,
          color:type.color || null,
          drawType:type.drawType || null,
          warp:type.warp || null,
          tile:tile
        });
      }
    }
  }
}

// =====================
// タイル取得（中心基準）
// =====================
function getTileAt(x,y){
  const col = Math.floor((x + player.size/2) / TILE);
  const row = Math.floor((y + player.size/2) / TILE);
  return mapData[row]?.[col];
}

// =====================
// 衝突判定
// =====================
function canMove(newX,newY){
  for(const b of blocks){
    if(!b.solid) continue;

    if(newX < b.x + b.size &&
       newX + player.size > b.x &&
       newY < b.y + b.size &&
       newY + player.size > b.y){
      return false;
    }
  }
  return true;
}

// =====================
// イベント処理（最適化コア）
// =====================
function handleTileEvent(x,y){
  const tile = getTileAt(x,y);
  if(!tile) return;

  const type = currentTileTypes[tile];

  // ワープ最優先
  if(type && type.warp){
    startFade(()=>{
      loadMap(type.warp.map, {
        x: type.warp.x,
        y: type.warp.y
      });
    });
    return;
  }

  // 会話イベント
  if(currentEvents[tile]){
    startTalk(currentEvents[tile]);
  }
}

// =====================
// 描画
// =====================
function draw(){

  if(isMoving){
    if(player.x < targetX) player.x += moveSpeed;
    if(player.x > targetX) player.x -= moveSpeed;
    if(player.y < targetY) player.y += moveSpeed;
    if(player.y > targetY) player.y -= moveSpeed;

    if(Math.abs(player.x-targetX)<=moveSpeed &&
       Math.abs(player.y-targetY)<=moveSpeed){
      player.x = targetX;
      player.y = targetY;
      isMoving = false;

      // ★ 移動後イベント発火（床も対応）
      if(!isTalking){
        handleTileEvent(player.x, player.y);
      }
    }
  }

  ctx.clearRect(0,0,canvas.width,canvas.height);

  cameraX = player.x - canvas.width/2 + player.size/2;
  cameraY = player.y - canvas.height/2 + player.size/2;

  cameraX = Math.max(0, Math.min(cameraX, mapWidth - canvas.width));
  cameraY = Math.max(0, Math.min(cameraY, mapHeight - canvas.height));

  blocks.forEach(b=>{
    const x = b.x - cameraX;
    const y = b.y - cameraY;

    if(b.image && images[b.image]?.complete){
      ctx.drawImage(images[b.image], x, y, b.size, b.size);
    }
    else if(b.drawType === "floor"){
      ctx.fillStyle="#7b3f61";
      ctx.fillRect(x,y,b.size,b.size);
      ctx.strokeStyle="#5e2e47";
      ctx.strokeRect(x,y,b.size,b.size);
    }
    else if(b.color){
      ctx.fillStyle=b.color;
      ctx.fillRect(x,y,b.size,b.size);
    }
  });

  ctx.fillStyle = player.color;
  ctx.fillRect(player.x-cameraX, player.y-cameraY, player.size, player.size);

  // マップ名表示
  if(mapTitleTimer>0){
    mapTitleTimer--;

    if(mapTitleTimer>120){
      mapTitleAlpha = Math.min(1, mapTitleAlpha+0.05);
    }else if(mapTitleTimer<60){
      mapTitleAlpha = Math.max(0, mapTitleAlpha-0.05);
    }

    ctx.save();
    ctx.globalAlpha = mapTitleAlpha;
    ctx.fillStyle="white";
    ctx.font="40px sans-serif";
    ctx.textAlign="center";
    ctx.fillText(mapTitle, canvas.width/2, 80);
    ctx.restore();
  }

  // フェード
  if(isFading){
    if(fadeMode==="out"){
      fadeAlpha+=0.05;
      if(fadeAlpha>=1){
        fadeAlpha=1;
        fadeMode="in";
        if(fadeCallback){
          fadeCallback();
          fadeCallback=null;
        }
      }
    }else{
      fadeAlpha-=0.05;
      if(fadeAlpha<=0){
        fadeAlpha=0;
        isFading=false;
      }
    }
    ctx.fillStyle="rgba(0,0,0,"+fadeAlpha+")";
    ctx.fillRect(0,0,canvas.width,canvas.height);
  }

  requestAnimationFrame(draw);
}
draw();

// =====================
// キー操作（最適版）
// =====================
document.addEventListener("keydown", e=>{

  if(isTalking){
    if(e.code==="Space") nextMessage();
    if(e.code==="KeyT") endTalk();
    return;
  }

  if(isMoving || isFading) return;

  let newX = player.x;
  let newY = player.y;

  if(e.key==="ArrowUp") newY -= TILE;
  if(e.key==="ArrowDown") newY += TILE;
  if(e.key==="ArrowLeft") newX -= TILE;
  if(e.key==="ArrowRight") newX += TILE;

  // 移動できる場合
  if(canMove(newX,newY)){
    targetX = newX;
    targetY = newY;
    isMoving = true;
  }else{
    // ★ ぶつかった瞬間のイベント（机・黒板など）
    if(!isTalking){
      handleTileEvent(newX, newY);
    }
  }
});
