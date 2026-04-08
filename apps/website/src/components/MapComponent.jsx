import { useEffect, useMemo, useRef, useState } from "react";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
} from "react-leaflet";
import L from "leaflet";
import { Search, Mic, SlidersHorizontal, Headphones } from "lucide-react";
import "leaflet/dist/leaflet.css";
import POIDetailPanel from "./POIDetailPanel";

// Fix for marker icons in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png",
});

const samplePOIs = [
  {
    id: 1,
    name: "Phở Thìn",
    description:
      "A traditional pho restaurant famous for its broth simmered for 24 hours. Fresh beef, tender noodles, and a welcoming atmosphere that always draws crowds.",
    descriptionVi:
      "Quán phở truyền thống nổi tiếng với nước dùng được nấu suốt 24 giờ. Thịt bò tươi ngon, bánh phở mỏng mềm. Địa chỉ hiếu khách, luôn có khách.",
    lat: 10.7719,
    lng: 106.7009,
    image:
      "https://images.unsplash.com/photo-1582158471487-881fac40a6f1?w=400&h=300&fit=crop",
    audioUrl: "/audio/pho-thin.wav",
    geofenceRadius: 100,
    category: "Food",
    durationLabel: "~1m 05s",
  },
  {
    id: 2,
    name: "Bánh Mì Nguyễn Hữu Cảnh",
    description:
      "Famous for its crispy crust and generous fillings including pâté, cold cuts, pickled vegetables, and the signature pungent fish sauce.",
    descriptionVi:
      "Bánh mì nổi tiếng với crust giòn, nhân đầy đặn gồm giăm, pâté, dưa cà rốt. Được ăn kèm với nước mắm chua cay đặc trưng.",
    lat: 10.7761,
    lng: 106.7095,
    image:
      "https://images.unsplash.com/photo-1555939594-58d7cb561643?w=400&h=300&fit=crop",
    audioUrl: "/audio/banh-mi-nguyen-huu-canh.wav",
    geofenceRadius: 120,
    category: "Food",
    durationLabel: "~1m 12s",
  },
  {
    id: 3,
    name: "Cơm Tấm Sài Gòn",
    description:
      "A Saigon specialty featuring broken rice served with grilled pork chops, shredded pork, egg, tomato, and cucumber. Savory, aromatic, and distinctly flavorful.",
    descriptionVi:
      "Cơm tấm - đặc sản Sài Gòn với hạt gạo nhỏ, ăn kèm sườn nướng, bì, trứng, cà chua, dưa leo. Vị mặn, mừi, thơm đặc trưng.",
    lat: 10.7774,
    lng: 106.6983,
    image:
      "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=400&h=300&fit=crop",
    audioUrl: "/audio/com-tam-sai-gon.wav",
    geofenceRadius: 90,
    category: "Food",
    durationLabel: "~1m 20s",
  },
  {
    id: 4,
    name: "Chè Ba Má",
    description:
      "A refreshing beverage shop offering various traditional Vietnamese sweet drinks made with beans and grains, served in a peaceful and welcoming atmosphere.",
    descriptionVi:
      "Quân chè ngon với các loại chè nành, chè đậu, chè hạt. Nước ngọt mát, được phục vụ trong không khí yên tĩnh.",
    lat: 10.7823,
    lng: 106.7063,
    image:
      "https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=400&h=300&fit=crop",
    audioUrl: "/audio/che-ba-ma.wav",
    geofenceRadius: 140,
    category: "Food",
    durationLabel: "~1m 08s",
  },
];

const AUTOPLAY_SESSION_KEY = "phoamthuc-autoplay-poi-ids";

const calculateDistanceMeters = (lat1, lng1, lat2, lng2) => {
  const toRad = (value) => (value * Math.PI) / 180;
  const earthRadius = 6371000;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};

export default function MapComponent() {
  const [selectedPOI, setSelectedPOI] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [mapInstance, setMapInstance] = useState(null);
  const [userPosition, setUserPosition] = useState(null);
  const [autoPlaySignal, setAutoPlaySignal] = useState(0);
  const [toastMessage, setToastMessage] = useState("");
  const [poiRadiusById, setPoiRadiusById] = useState(() =>
    Object.fromEntries(
      samplePOIs.map((poi) => [poi.id, poi.geofenceRadius || 120]),
    ),
  );

  const enteredPoiIdsRef = useRef(new Set());
  const autoplayedPoiIdsRef = useRef(new Set());

  const defaultPosition = [10.7769, 106.7009];

  const normalizeText = (value) =>
    (value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  const filteredPOIs = useMemo(() => {
    const keyword = normalizeText(searchText.trim());
    if (!keyword) return samplePOIs;

    return samplePOIs.filter((poi) => {
      const haystack = normalizeText(
        `${poi.name} ${poi.description} ${poi.descriptionVi}`,
      );
      return haystack.includes(keyword);
    });
  }, [searchText]);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(AUTOPLAY_SESSION_KEY);
      if (!raw) return;

      const parsedIds = JSON.parse(raw);
      if (Array.isArray(parsedIds)) {
        autoplayedPoiIdsRef.current = new Set(parsedIds);
      }
    } catch {
      autoplayedPoiIdsRef.current = new Set();
    }
  }, []);

  useEffect(() => {
    if (!toastMessage) return;

    const timeoutId = window.setTimeout(() => {
      setToastMessage("");
    }, 2600);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toastMessage]);

  useEffect(() => {
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserPosition([latitude, longitude]);

        const insideNow = new Set();
        let nearestEnteredPOI = null;
        let nearestDistance = Number.POSITIVE_INFINITY;

        samplePOIs.forEach((poi) => {
          const poiRadius = poiRadiusById[poi.id] || 120;
          const distance = calculateDistanceMeters(
            latitude,
            longitude,
            poi.lat,
            poi.lng,
          );

          if (distance <= poiRadius) {
            insideNow.add(poi.id);

            if (
              !enteredPoiIdsRef.current.has(poi.id) &&
              distance < nearestDistance
            ) {
              nearestEnteredPOI = poi;
              nearestDistance = distance;
            }
          }
        });

        enteredPoiIdsRef.current = insideNow;

        if (nearestEnteredPOI) {
          setSelectedPOI(nearestEnteredPOI);
          setSearchText(nearestEnteredPOI.name);
          setToastMessage(`Bạn đã vào vùng ${nearestEnteredPOI.name}`);

          if (!autoplayedPoiIdsRef.current.has(nearestEnteredPOI.id)) {
            autoplayedPoiIdsRef.current.add(nearestEnteredPOI.id);
            sessionStorage.setItem(
              AUTOPLAY_SESSION_KEY,
              JSON.stringify(Array.from(autoplayedPoiIdsRef.current)),
            );
            setAutoPlaySignal((value) => value + 1);
          }

          if (mapInstance) {
            mapInstance.flyTo(
              [nearestEnteredPOI.lat, nearestEnteredPOI.lng],
              16,
              {
                duration: 1.2,
              },
            );
          }
        }
      },
      () => {
        // Ignore geolocation errors silently; manual search still works.
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      },
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [mapInstance, poiRadiusById]);

  const handleRadiusChange = (poiId, radius) => {
    setPoiRadiusById((prev) => ({
      ...prev,
      [poiId]: radius,
    }));
  };

  const focusPOI = (poi) => {
    setSelectedPOI(poi);
    setSearchText(poi.name);

    if (!mapInstance) return;

    mapInstance.flyTo([poi.lat, poi.lng], 16, {
      duration: 1.2,
    });
  };

  return (
    <div className="w-full h-full relative">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-4xl">
        <div className="flex items-center rounded-2xl bg-white shadow-lg px-4 py-3 border border-gray-100">
          <Search size={22} className="text-slate-400 shrink-0" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filteredPOIs.length > 0) {
                focusPOI(filteredPOIs[0]);
              }
            }}
            placeholder="Search food, landmarks on Vĩnh Khánh street..."
            className="flex-1 px-3 text-base outline-none text-slate-700 placeholder:text-slate-400"
          />
          <button
            type="button"
            className="text-orange-500 hover:text-orange-600 transition"
            aria-label="Voice search"
          >
            <Mic size={22} />
          </button>
        </div>

        {searchText.trim() && (
          <div className="mt-2 rounded-2xl bg-white shadow-lg border border-gray-100 overflow-hidden">
            {filteredPOIs.length > 0 ? (
              filteredPOIs.slice(0, 5).map((poi) => (
                <button
                  key={poi.id}
                  type="button"
                  onClick={() => focusPOI(poi)}
                  className="w-full text-left px-4 py-3 hover:bg-orange-50 transition border-b border-gray-100 last:border-b-0"
                >
                  <p className="font-semibold text-slate-800">{poi.name}</p>
                  <p className="text-sm text-slate-500 line-clamp-1">
                    {poi.descriptionVi || poi.description}
                  </p>
                </button>
              ))
            ) : (
              <p className="px-4 py-3 text-sm text-slate-500">
                Không tìm thấy địa điểm phù hợp.
              </p>
            )}
          </div>
        )}

        <details className="mt-2 rounded-2xl bg-white/95 shadow-lg border border-gray-100 overflow-hidden">
          <summary className="cursor-pointer list-none px-4 py-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
            <SlidersHorizontal size={16} className="text-orange-500" />
            Chỉnh bán kính nhận diện POI
          </summary>

          <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
            {samplePOIs.map((poi) => (
              <label key={`radius-${poi.id}`} className="block">
                <div className="flex items-center justify-between mb-1 text-xs text-slate-600">
                  <span className="font-medium">{poi.name}</span>
                  <span>{poiRadiusById[poi.id]}m</span>
                </div>
                <input
                  type="range"
                  min="60"
                  max="250"
                  step="10"
                  value={poiRadiusById[poi.id]}
                  onChange={(event) =>
                    handleRadiusChange(poi.id, Number(event.target.value))
                  }
                  className="w-full accent-orange-500"
                />
              </label>
            ))}
          </div>
        </details>
      </div>

      <MapContainer
        center={defaultPosition}
        zoom={13}
        zoomControl={false}
        whenReady={(event) => setMapInstance(event.target)}
        style={{ width: "100%", height: "100%" }}
        className="rounded-lg"
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {samplePOIs.map((poi) => (
          <Circle
            key={`geofence-${poi.id}`}
            center={[poi.lat, poi.lng]}
            radius={poiRadiusById[poi.id] || 120}
            pathOptions={{
              color: "#f97316",
              fillColor: "#fb923c",
              fillOpacity: 0.12,
              weight: 1,
            }}
          />
        ))}

        {userPosition && (
          <CircleMarker
            center={userPosition}
            radius={8}
            pathOptions={{
              color: "#2563eb",
              fillColor: "#3b82f6",
              fillOpacity: 1,
              weight: 2,
            }}
          />
        )}

        {filteredPOIs.map((poi) => (
          <Marker
            key={poi.id}
            position={[poi.lat, poi.lng]}
            eventHandlers={{
              click: () => setSelectedPOI(poi),
            }}
          >
            <Tooltip
              className="poi-preview-tooltip"
              direction="top"
              offset={[0, -18]}
              opacity={1}
              interactive
            >
              <div className="poi-preview-card bg-white rounded-[20px] overflow-hidden">
                {poi.image && (
                  <div className="h-24 w-full overflow-hidden">
                    <img
                      src={poi.image}
                      alt={poi.name}
                      className="h-full w-full object-cover block"
                    />
                  </div>
                )}

                <div className="px-3 py-2">
                  <h3 className="text-base leading-tight font-extrabold text-slate-800 mb-1 whitespace-normal wrap-break-word">
                    {poi.name}
                  </h3>

                  <p className="text-slate-600 text-xs leading-relaxed mb-2 whitespace-normal wrap-break-word poi-preview-description">
                    {poi.description}
                  </p>

                  <div className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-1 mb-2">
                    <span className="text-xs">🍜</span>
                    <span className="text-orange-500 font-semibold text-xs">
                      {poi.category || "Food"}
                    </span>
                  </div>

                  <div className="flex items-center justify-between gap-2 border-t border-slate-200 pt-2">
                    <div className="inline-flex items-center gap-1.5 text-slate-500 text-xs font-medium">
                      <Headphones size={14} />
                      <span className="whitespace-normal wrap-break-word">
                        {poi.durationLabel || "~1m 10s"}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => focusPOI(poi)}
                      className="rounded-full bg-orange-500 px-3 py-1.5 text-white text-xs font-bold hover:bg-orange-600 transition"
                    >
                      Listen narration
                    </button>
                  </div>
                </div>
              </div>
            </Tooltip>
          </Marker>
        ))}
      </MapContainer>

      {selectedPOI && (
        <POIDetailPanel
          key={selectedPOI.id}
          poi={selectedPOI}
          autoPlayTrigger={autoPlaySignal}
          onClose={() => setSelectedPOI(null)}
        />
      )}

      {toastMessage && (
        <div className="pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 z-50">
          <div className="rounded-full bg-slate-900/90 text-white text-sm font-medium px-4 py-2 shadow-lg">
            {toastMessage}
          </div>
        </div>
      )}
    </div>
  );
}
