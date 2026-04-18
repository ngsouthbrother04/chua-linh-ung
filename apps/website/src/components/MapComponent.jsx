import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  TileLayer,
  Tooltip,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import { Search } from "lucide-react";
import { poisAPI } from "../lib/api";
import {
  useLanguage,
  pickLocalizedText,
  useTranslation,
} from "../hooks/useLanguageContext";
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

const AUTOPLAY_SESSION_KEY = "phoamthuc-autoplay-poi-ids";
const DEFAULT_POI_RADIUS_METERS = 120;
const DEFAULT_POSITION = [10.7769, 106.7009];
const POI_TYPE_LABEL = {
  FOOD: "Food",
  DRINK: "Drink",
  SNACK: "Snack",
  WC: "WC",
};

const POI_TYPE_ICON = {
  FOOD: "🍜",
  DRINK: "🥤",
  SNACK: "🍢",
  WC: "🚻",
};

const resolvePrimaryAudioUrl = (audioUrls, language) => {
  if (!audioUrls || typeof audioUrls !== "object") return "";

  return (
    audioUrls[language] ||
    audioUrls.vi ||
    audioUrls.en ||
    Object.values(audioUrls)[0] ||
    ""
  );
};

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

function MapClickHandler({ onMapClick }) {
  useMapEvents({
    click(event) {
      onMapClick(event.latlng.lat, event.latlng.lng);
    },
  });

  return null;
}

export default function MapComponent() {
  const [poisRaw, setPoisRaw] = useState([]);
  const [selectedPOI, setSelectedPOI] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [mapInstance, setMapInstance] = useState(null);
  const [userPosition, setUserPosition] = useState(null);
  const [autoPlaySignal, setAutoPlaySignal] = useState(0);
  const [toastMessage, setToastMessage] = useState("");
  const [, setIsLoadingPOIs] = useState(false);
  const enteredPoiIdsRef = useRef(new Set());
  const autoplayedPoiIdsRef = useRef(new Set());
  const { language } = useLanguage();
  const t = useTranslation();

  // Normalize POIs based on current language
  const pois = useMemo(
    () =>
      (poisRaw || []).map((poi) => {
        const latitude = Number(poi.latitude);
        const longitude = Number(poi.longitude);
        const radius = Number(poi.radius);
        const normalizedRadius =
          Number.isFinite(radius) && radius > 0
            ? radius
            : DEFAULT_POI_RADIUS_METERS;
        const audioUrl = resolvePrimaryAudioUrl(poi.audioUrls, language);

        return {
          ...poi,
          latitude: Number.isFinite(latitude) ? latitude : DEFAULT_POSITION[0],
          longitude: Number.isFinite(longitude)
            ? longitude
            : DEFAULT_POSITION[1],
          radius: normalizedRadius,
          name: pickLocalizedText(poi.name, language, "Untitled POI"),
          description: pickLocalizedText(poi.description, language, ""),
          descriptionVi: pickLocalizedText(poi.description, "vi", ""),
          categoryLabel:
            POI_TYPE_LABEL[String(poi.type || "").toUpperCase()] ||
            String(poi.type || "POI"),
          categoryIcon:
            POI_TYPE_ICON[String(poi.type || "").toUpperCase()] || "📍",
          audioUrl,
        };
      }),
    [poisRaw, language],
  );

  const normalizeText = (value) =>
    (value || "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase();

  // Fetch POIs when map bounds change
  const fetchPOIsByBounds = useCallback(async (north, south, east, west) => {
    try {
      setIsLoadingPOIs(true);
      const data = await poisAPI.getByBounds(north, south, east, west);
      setPoisRaw(data || []);
    } catch (err) {
      console.error("Failed to fetch POIs:", err);
      setPoisRaw([]);
    } finally {
      setIsLoadingPOIs(false);
    }
  }, []);

  // Load initial POIs when map instance is ready
  useEffect(() => {
    if (!mapInstance) return;
    const bounds = mapInstance.getBounds();
    fetchPOIsByBounds(
      bounds.getNorth(),
      bounds.getSouth(),
      bounds.getEast(),
      bounds.getWest(),
    );
  }, [mapInstance, fetchPOIsByBounds]);

  // Refetch POIs when map pans or zooms
  useEffect(() => {
    if (!mapInstance) return;
    const handleMoveEnd = () => {
      const bounds = mapInstance.getBounds();
      fetchPOIsByBounds(
        bounds.getNorth(),
        bounds.getSouth(),
        bounds.getEast(),
        bounds.getWest(),
      );
    };
    mapInstance.on("moveend", handleMoveEnd);
    return () => mapInstance.off("moveend", handleMoveEnd);
  }, [mapInstance, fetchPOIsByBounds]);

  // Update selectedPOI when language changes (to get updated localized text)
  useEffect(() => {
    if (!selectedPOI) return;
    const updatedPOI = pois.find((p) => p.id === selectedPOI.id);
    if (updatedPOI && updatedPOI.name !== selectedPOI.name) {
      setSelectedPOI(updatedPOI);
    }
  }, [pois, selectedPOI]);

  const filteredPOIs = useMemo(() => {
    const keyword = normalizeText(searchText.trim());
    if (!keyword) return pois;

    return pois.filter((poi) => {
      const haystack = normalizeText(
        `${poi.name} ${poi.description} ${poi.descriptionVi}`,
      );
      return haystack.includes(keyword);
    });
  }, [searchText, pois]);

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

        pois.forEach((poi) => {
          const distance = calculateDistanceMeters(
            latitude,
            longitude,
            poi.latitude,
            poi.longitude,
          );

          if (distance <= (Number(poi.radius) || DEFAULT_POI_RADIUS_METERS)) {
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
              [nearestEnteredPOI.latitude, nearestEnteredPOI.longitude],
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
  }, [mapInstance, pois]);

  const focusPOI = (poi) => {
    setSelectedPOI(poi);
    setSearchText(poi.name);

    if (!mapInstance) return;

    mapInstance.flyTo([poi.latitude, poi.longitude], 16, {
      duration: 1.2,
    });
  };

  const handleMapClick = (lat, lng) => {
    setUserPosition([lat, lng]);

    if (mapInstance) {
      mapInstance.flyTo([lat, lng], 16, {
        duration: 1.1,
      });
    }

    let nearestPOI = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const poi of pois) {
      const distance = calculateDistanceMeters(
        lat,
        lng,
        poi.latitude,
        poi.longitude,
      );
      const poiRadius = Number(poi.radius) || DEFAULT_POI_RADIUS_METERS;

      if (distance <= poiRadius && distance < nearestDistance) {
        nearestPOI = poi;
        nearestDistance = distance;
      }
    }

    if (!nearestPOI) {
      return;
    }

    setSelectedPOI(nearestPOI);
    setSearchText(nearestPOI.name);
    setToastMessage(`Bạn đã vào vùng ${nearestPOI.name}`);

    if (!nearestPOI.audioUrl) {
      setToastMessage(`POI ${nearestPOI.name} chưa có audio để tự phát`);
      return;
    }

    setAutoPlaySignal((value) => value + 1);
  };

  return (
    <div className="w-full h-full relative">
      <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-4xl">
        <div className="flex items-center rounded-2xl border border-white/20 bg-transparent px-4 py-3 shadow-lg backdrop-blur-sm">
          <Search size={22} className="shrink-0 text-slate-600" />
          <input
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && filteredPOIs.length > 0) {
                focusPOI(filteredPOIs[0]);
              }
            }}
            placeholder={t.map.search}
            className="flex-1 bg-transparent px-3 text-base text-slate-800 outline-none placeholder:text-slate-600"
          />
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
                {t.map.noResults}
              </p>
            )}
          </div>
        )}
      </div>

      <MapContainer
        center={DEFAULT_POSITION}
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

        <MapClickHandler onMapClick={handleMapClick} />

        {pois.map((poi) => (
          <Circle
            key={`geofence-${poi.id}`}
            center={[poi.latitude, poi.longitude]}
            radius={poi.radius}
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
            position={[poi.latitude, poi.longitude]}
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
                    <span className="text-xs">{poi.categoryIcon}</span>
                    <span className="text-orange-500 font-semibold text-xs">
                      {poi.categoryLabel}
                    </span>
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
