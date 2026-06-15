import { addRoadsideDaylilies } from "./map-models.js";

const daylilyModel = document.querySelector("#daylilyModel");

if (daylilyModel) {
  daylilyModel.addEventListener("load", () => {
    const animations = daylilyModel.availableAnimations || [];

    if (animations.length > 0) {
      daylilyModel.animationName = animations[0];
      daylilyModel.play();
    }
  });
}

const immersiveTopics = {
  flower: {
    label: "Flower",
    title: "花朵：橘黃色的忘憂之花",
    text: "金針花花形多為漏斗狀或喇叭狀，橘黃色花瓣明亮醒目。單朵花通常只開一天左右，但整株會輪流開花，因此花季仍能持續數週。",
    photo: "images/immersive/IMG_7893.jpg",
    alt: "金針花正面近照"
  },
  bud: {
    label: "Bud",
    title: "花苞：食用金針菜的來源",
    text: "未開花的花苞可作為食用金針菜，常見料理包含金針排骨湯與炒金針。不過部分品種需經過適當處理才可安全食用。",
    photo: "images/immersive/IMG_7894.jpg",
    alt: "金針花花苞近照"
  },
  leaf: {
    label: "Leaf",
    title: "葉片：細長叢生的植株特徵",
    text: "金針花葉片細長，叢生於基部。它喜歡充足陽光，也能在半日照環境生長，適合排水良好的砂質土或壤土。",
    photo: "images/immersive/IMG_7895.jpg",
    alt: "金針花葉片與植株"
  },
  place: {
    label: "Campus",
    title: "校園位置：入口斜坡道路兩旁",
    text: "展示用 3D 金針花沿校園入口斜坡道路兩旁排列，形成兩排迎賓花帶。實際種植位置仍需由團隊實地確認。",
    photo: "images/immersive/IMG_7898.jpg",
    alt: "金針花校園位置遠景"
  }
};

const immersiveLabel = document.querySelector("#immersiveLabel");
const immersiveTitle = document.querySelector("#immersiveTitle");
const immersiveText = document.querySelector("#immersiveText");
const immersivePhoto = document.querySelector("#immersivePhoto");
const topicButtons = document.querySelectorAll("[data-topic]");
const mapButtons = document.querySelectorAll("[data-map-action]");

function setImmersiveTopic(topicName) {
  const topic = immersiveTopics[topicName];

  if (!topic || !immersiveLabel || !immersiveTitle || !immersiveText || !immersivePhoto) {
    return;
  }

  immersiveLabel.textContent = topic.label;
  immersiveTitle.textContent = topic.title;
  immersiveText.textContent = topic.text;
  immersivePhoto.src = topic.photo;
  immersivePhoto.alt = topic.alt;

  topicButtons.forEach((button) => {
    button.classList.toggle("active", button.dataset.topic === topicName);
  });
}

topicButtons.forEach((button) => {
  button.addEventListener("click", () => setImmersiveTopic(button.dataset.topic));
});

const campusCenter = [120.59468, 23.99932];
const flowerLocation = [120.59462, 23.99923];
const fallbackSlopeRoadPath = [
  [120.59418, 23.99893],
  [120.59442, 23.99904],
  [120.59467, 23.99917],
  [120.59491, 23.99931],
  [120.59511, 23.99946]
];
const campusView = {
  center: campusCenter,
  zoom: 17.2,
  pitch: 64,
  bearing: -28
};

function createRoadsideRows(path, sideOffsetMeters, spacingMeters) {
  const metersPerLatitude = 111320;
  const metersPerLongitude = metersPerLatitude * Math.cos(campusCenter[1] * Math.PI / 180);
  const rows = [[], []];

  for (let segmentIndex = 0; segmentIndex < path.length - 1; segmentIndex += 1) {
    const start = path[segmentIndex];
    const end = path[segmentIndex + 1];
    const dx = (end[0] - start[0]) * metersPerLongitude;
    const dy = (end[1] - start[1]) * metersPerLatitude;
    const segmentLength = Math.hypot(dx, dy);
    const stepCount = Math.max(1, Math.round(segmentLength / spacingMeters));
    const normalX = -dy / segmentLength;
    const normalY = dx / segmentLength;

    for (let step = 0; step < stepCount; step += 1) {
      const progress = step / stepCount;
      const centerLng = start[0] + (end[0] - start[0]) * progress;
      const centerLat = start[1] + (end[1] - start[1]) * progress;

      rows[0].push([
        centerLng + normalX * sideOffsetMeters / metersPerLongitude,
        centerLat + normalY * sideOffsetMeters / metersPerLatitude
      ]);
      rows[1].push([
        centerLng - normalX * sideOffsetMeters / metersPerLongitude,
        centerLat - normalY * sideOffsetMeters / metersPerLatitude
      ]);
    }
  }

  return rows;
}

function distanceMeters(a, b) {
  const metersPerLatitude = 111320;
  const metersPerLongitude = metersPerLatitude * Math.cos(campusCenter[1] * Math.PI / 180);
  return Math.hypot(
    (b[0] - a[0]) * metersPerLongitude,
    (b[1] - a[1]) * metersPerLatitude
  );
}

function distanceToSegmentMeters(point, start, end) {
  const metersPerLatitude = 111320;
  const metersPerLongitude = metersPerLatitude * Math.cos(campusCenter[1] * Math.PI / 180);
  const px = (point[0] - start[0]) * metersPerLongitude;
  const py = (point[1] - start[1]) * metersPerLatitude;
  const dx = (end[0] - start[0]) * metersPerLongitude;
  const dy = (end[1] - start[1]) * metersPerLatitude;
  const lengthSquared = dx * dx + dy * dy;
  const progress = lengthSquared > 0
    ? Math.max(0, Math.min(1, (px * dx + py * dy) / lengthSquared))
    : 0;

  return Math.hypot(px - dx * progress, py - dy * progress);
}

function getRoadLineCandidates(feature) {
  if (feature.geometry.type === "LineString") {
    return [feature.geometry.coordinates];
  }

  if (feature.geometry.type === "MultiLineString") {
    return feature.geometry.coordinates;
  }

  return [];
}

function findRoadPath(map, targetLocation) {
  const targetPoint = map.project(targetLocation);
  const searchRadius = 180;
  const roadLayers = map.getStyle().layers
    .filter((layer) => layer["source-layer"] === "transportation" && layer.type === "line")
    .map((layer) => layer.id);
  const features = map.queryRenderedFeatures(
    [
      [targetPoint.x - searchRadius, targetPoint.y - searchRadius],
      [targetPoint.x + searchRadius, targetPoint.y + searchRadius]
    ],
    { layers: roadLayers }
  );
  const classPenalty = {
    minor: 0,
    service: 1,
    tertiary: 4,
    secondary: 8,
    primary: 12,
    path: 25,
    track: 30
  };
  const candidates = [];

  features.forEach((feature) => {
    getRoadLineCandidates(feature).forEach((coordinates) => {
      if (coordinates.length < 2) {
        return;
      }

      let nearestDistance = Infinity;
      let length = 0;

      for (let index = 0; index < coordinates.length - 1; index += 1) {
        nearestDistance = Math.min(
          nearestDistance,
          distanceToSegmentMeters(targetLocation, coordinates[index], coordinates[index + 1])
        );
        length += distanceMeters(coordinates[index], coordinates[index + 1]);
      }

      const roadClass = feature.properties.class || feature.properties.subclass || "";
      candidates.push({
        coordinates,
        score: nearestDistance + (classPenalty[roadClass] ?? 15) - Math.min(length, 120) / 120
      });
    });
  });

  const bestRoad = candidates.sort((a, b) => a.score - b.score)[0];
  return bestRoad?.coordinates || null;
}

function initializeImmersiveMap() {
  const mapContainer = document.querySelector("#immersiveMap");
  const mapStatus = document.querySelector("#mapStatus");

  if (!mapContainer || typeof maplibregl === "undefined") {
    if (mapStatus) {
      mapStatus.textContent = "免費 3D 地圖載入失敗，請確認網路連線後重新整理。";
    }
    return;
  }

  const map = new maplibregl.Map({
    container: mapContainer,
    style: "https://tiles.openfreemap.org/styles/liberty",
    center: campusView.center,
    zoom: campusView.zoom,
    pitch: campusView.pitch,
    bearing: campusView.bearing,
    antialias: true,
    maxPitch: 80,
    attributionControl: true
  });
  window.immersiveMap = map;

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
  map.addControl(new maplibregl.FullscreenControl(), "top-right");

  const markerElement = document.createElement("button");
  markerElement.className = "daylily-map-marker";
  markerElement.type = "button";
  markerElement.setAttribute("aria-label", "查看金針花校園位置");
  markerElement.innerHTML = "<span aria-hidden=\"true\">✿</span>";

  const popup = new maplibregl.Popup({ offset: 30 }).setHTML(
    "<strong>金針花校園位置</strong><br>入口斜坡道路兩旁花帶（位置為專題展示用標記）"
  );

  new maplibregl.Marker({ element: markerElement, anchor: "bottom" })
    .setLngLat(flowerLocation)
    .setPopup(popup)
    .addTo(map);

  markerElement.addEventListener("click", () => {
    window.location.href = "https://cooby19.github.io/flower_VR/";
  });

  map.on("load", () => {
    map.once("idle", () => {
      const renderedRoadPath = findRoadPath(map, flowerLocation);
      const roadPath = renderedRoadPath || fallbackSlopeRoadPath;
      const roadsideDaylilyRows = createRoadsideRows(roadPath, 5.5, 7);
      window.roadsideDaylilyPath = roadPath;
      window.roadsideDaylilySource = renderedRoadPath ? "openfreemap" : "fallback";
      addRoadsideDaylilies(map, roadsideDaylilyRows);
    });

    if (mapStatus) {
      mapStatus.classList.add("hidden");
    }
  });

  map.on("error", () => {
    if (mapStatus && !mapStatus.classList.contains("hidden")) {
      mapStatus.textContent = "免費 3D 地圖暫時無法載入，請稍後重新整理。";
    }
  });

  mapButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const action = button.dataset.mapAction;
      mapButtons.forEach((item) => item.classList.toggle("active", item === button));

      if (action === "top") {
        map.easeTo({ center: campusCenter, zoom: 17, pitch: 0, bearing: 0, duration: 1000 });
      } else if (action === "flower") {
        map.flyTo({ center: flowerLocation, zoom: 17.8, pitch: 68, bearing: -36, duration: 1400 });
        popup.addTo(map);
        setImmersiveTopic("place");
      } else {
        map.flyTo({ ...campusView, duration: 1400 });
      }
    });
  });
}

initializeImmersiveMap();
