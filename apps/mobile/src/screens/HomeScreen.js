import React, { useState, useEffect, useRef } from "react";
import { 
  View, Text, StyleSheet, Dimensions, TextInput, 
  ScrollView, TouchableOpacity, FlatList, ActivityIndicator, Modal, Alert, StatusBar, TouchableWithoutFeedback 
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE, Circle } from "react-native-maps";
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import { CommonActions } from '@react-navigation/native';
import API from "../api/api";
import { autoTranslate } from "../utils/translator";
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get("window");

const getDistance = (lat1, lon1, lat2, lon2) => {
  const R = 6371e3; 
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; 
};

const LANGUAGES = [
  { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳', locale: 'vi-VN' },
  { code: 'en', name: 'English', flag: '🇺🇸', locale: 'en-US' },
  { code: 'th', name: 'ภาษาไทย', flag: '🇹🇭', locale: 'th-TH' },
  { code: 'ja', name: '日本語', flag: '🇯🇵', locale: 'ja-JP' },
  { code: 'ko', name: '한국어', flag: '🇰🇷', locale: 'ko-KR' },
  { code: 'fr', name: 'Français', flag: '🇫🇷', locale: 'fr-FR' },
];

export default function HomeScreen({ navigation }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [isScannerVisible, setIsScannerVisible] = useState(false);
  const [scanned, setScanned] = useState(false);

  const [pois, setPois] = useState([]);
  const poisRef = useRef([]); 
  const [filteredPois, setFilteredPois] = useState([]);
  const [selectedPoi, setSelectedPoi] = useState(null);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState({ latitude: 10.7712, longitude: 106.6901 });

  const [searchQuery, setSearchQuery] = useState("");
  const [isDropdownVisible, setIsDropdownVisible] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);
  const [isLangModalVisible, setIsLangModalVisible] = useState(false);
  
  const [lang, setLang] = useState(LANGUAGES[0]);
  const [translatedData, setTranslatedData] = useState({ name: "", desc: "" });
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);

  const [uiLabels, setUiLabels] = useState({
    searchPlaceholder: "Tìm kiếm địa điểm...", profileTitle: "Trang cá nhân", profileLink: "Hồ sơ cá nhân",
    scanQR: "Quét QR", logout: "Đăng xuất", details: "THÔNG TIN CHI TIẾT",
    listen: "🔊 NGHE THUYẾT MINH", stop: "⏹ DỪNG PHÁT", closeMenu: "Đóng menu", langTitle: "Chọn Ngôn Ngữ"
  });

  const [userData, setUserData] = useState({ name: "Người dùng", email: "" });
  const mapRef = useRef(null);
  const lastPlayedPoiId = useRef(null); 

  useEffect(() => {
    fetchPois();
    loadUserData();
    const unsubscribe = navigation.addListener('focus', loadUserData);
    return unsubscribe;
  }, [navigation]);

  useEffect(() => {
    if (pois.length > 0) checkGeofencing();
  }, [userLocation, pois]);

  useEffect(() => {
    const translateUI = async () => {
      if (lang.code === 'vi') {
        setUiLabels({
          searchPlaceholder: "Tìm kiếm địa điểm...", profileTitle: "Trang cá nhân", profileLink: "Hồ sơ cá nhân",
          scanQR: "Quét QR", logout: "Đăng xuất", details: "THÔNG TIN CHI TIẾT",
          listen: "🔊 NGHE THUYẾT MINH", stop: "⏹ DỪNG PHÁT", closeMenu: "Đóng menu", langTitle: "Chọn Ngôn Ngữ"
        });
        navigation.setOptions({ title: "🏠 Trang chủ" });
      } else {
        try {
          const keys = Object.keys(uiLabels);
          const translatedValues = await Promise.all(
            Object.values(uiLabels).map(val => autoTranslate(val.replace(/🔊 |⏹ /g, ""), lang.code))
          );
          const newLabels = {};
          keys.forEach((key, i) => {
            let prefix = key === "listen" ? "🔊 " : (key === "stop" ? "⏹ " : "");
            newLabels[key] = prefix + translatedValues[i];
          });
          setUiLabels(newLabels);
          const translatedHome = await autoTranslate("Trang chủ", lang.code);
          navigation.setOptions({ title: `🏠 ${translatedHome}` });
        } catch (e) { console.log(e); }
      }
    };
    translateUI();
  }, [lang]);

  useEffect(() => {
    if (selectedPoi) handleAutoTranslate(selectedPoi, false);
  }, [selectedPoi, lang]);

  const playSpeech = (text) => {
    if (!text || typeof text !== 'string') return;
    Speech.stop();
    setIsSpeaking(true);
    Speech.speak(text, { language: lang.locale, rate: 0.9, onDone: () => setIsSpeaking(false) });
  };

  const handleAutoTranslate = async (poi, shouldPlay = false) => {
    if (!poi) return;
    const originName = typeof poi.name === 'object' ? (poi.name?.vi || poi.name?.en || "") : (poi.name || "");
    const originDesc = typeof poi.description === 'object' ? (poi.description?.vi || poi.description?.en || "") : (poi.description || "");

    let finalName = originName;
    let finalDesc = originDesc;

    if (lang.code !== 'vi') {
      setIsTranslating(true);
      try {
        if (typeof poi.name === 'object' && poi.name[lang.code]) {
          finalName = poi.name[lang.code];
          finalDesc = poi.description[lang.code];
        } else {
          const [tName, tDesc] = await Promise.all([
            autoTranslate(originName, lang.code), autoTranslate(originDesc, lang.code)
          ]);
          finalName = tName; finalDesc = tDesc;
        }
      } catch (e) { console.log(e); } finally { setIsTranslating(false); }
    }

    setTranslatedData({ name: finalName, desc: finalDesc });
    if (shouldPlay) playSpeech(finalDesc);
  };

  const handleBarCodeScanned = async ({ data }) => {
    if (scanned) return;
    setScanned(true);
    setIsScannerVisible(false);
    const foundPoi = poisRef.current.find(p => p.id.toString() === data.trim());
    if (foundPoi) {
      lastPlayedPoiId.current = foundPoi.id;
      setSelectedPoi(foundPoi);
      handleAutoTranslate(foundPoi, true); 
      mapRef.current?.animateToRegion({
        latitude: parseFloat(foundPoi.latitude), longitude: parseFloat(foundPoi.longitude),
        latitudeDelta: 0.005, longitudeDelta: 0.005
      }, 1000);
    }
  };

  const checkGeofencing = async () => {
    const currentPois = poisRef.current;
    if (currentPois.length === 0) return;
    let nearestPoi = null;
    let minDistance = 101; 

    for (let poi of currentPois) {
      const dist = getDistance(
        parseFloat(userLocation.latitude), parseFloat(userLocation.longitude), 
        parseFloat(poi.latitude), parseFloat(poi.longitude)
      );
      if (dist <= 100 && dist < minDistance) {
        minDistance = dist;
        nearestPoi = poi;
      }
    }

    if (nearestPoi) {
      if (lastPlayedPoiId.current !== nearestPoi.id) {
        lastPlayedPoiId.current = nearestPoi.id;
        setSelectedPoi(nearestPoi);
        handleAutoTranslate(nearestPoi, true); 

        let title = "📍 Vào vùng ảnh hưởng";
        if (lang.code !== 'vi') { try { title = await autoTranslate(title, lang.code); } catch (e) {} }
        const nameStr = typeof nearestPoi.name === 'object' ? (nearestPoi.name?.vi || nearestPoi.name?.en || "") : nearestPoi.name;
        Alert.alert(title, nameStr);
      }
    } else {
      lastPlayedPoiId.current = null;
    }
  };

  const fetchPois = async () => {
    try {
      setLoading(true);
      const token = await AsyncStorage.getItem('userToken');
      const res = await API.get("/pois", { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.data?.items) {
        const items = res.data.data.items;
        setPois(items);
        poisRef.current = items;
        setFilteredPois(items);
      }
    } catch (e) { console.log(e); } finally { setLoading(false); }
  };

  const loadUserData = async () => {
    try {
      const localName = await AsyncStorage.getItem('userName');
      const localEmail = await AsyncStorage.getItem('userEmail');
      if (localName) {
        setUserData({ name: localName, email: localEmail || "" });
      }
      const token = await AsyncStorage.getItem('userToken');
      if (!token) return;
      const res = await API.get("/users/profile", { headers: { Authorization: `Bearer ${token}` } });
      if (res.data?.status === "success") {
        const { fullName, email } = res.data.data;
        setUserData({ name: fullName || localName || "Người dùng", email: email || localEmail || "" });
        await AsyncStorage.setItem('userName', fullName || "");
        await AsyncStorage.setItem('userEmail', email || "");
      }
    } catch (e) { console.log("Lỗi tải profile:", e); }
  };

  const handleToggleSpeech = () => {
    if (isSpeaking) { Speech.stop(); setIsSpeaking(false); }
    else playSpeech(translatedData.desc);
  };

  const handleLogout = async () => {
    setIsMenuVisible(false);
    Alert.alert(uiLabels.logout, "Thoát ứng dụng?", [
      { text: "Hủy", style: "cancel" },
      { text: uiLabels.logout, onPress: async () => {
          await Speech.stop(); await AsyncStorage.clear();
          navigation.dispatch(CommonActions.reset({ index: 0, routes: [{ name: 'Login' }] }));
      }}
    ]);
  };

  if (loading) return <View style={styles.center}><ActivityIndicator size="large" color="#FF6F00" /></View>;

  return (
    <View style={styles.container}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

      {/* SEARCH SECTION UPGRADED */}
      <View style={styles.searchSection}>
        <View style={styles.topRow}>
          <TouchableOpacity style={styles.roundBtn} onPress={() => setIsMenuVisible(true)}>
            <Ionicons name="menu" size={26} color="#333" />
          </TouchableOpacity>
          <View style={styles.searchBar}>
            <Ionicons name="search" size={18} color="#999" />
            <TextInput
              placeholder={uiLabels.searchPlaceholder} style={styles.input}
              value={searchQuery} onChangeText={(text) => {
                setSearchQuery(text);
                if (!text) { setFilteredPois(pois); setIsDropdownVisible(false); return; }
                const filtered = pois.filter(p => {
                  const nameStr = typeof p.name === 'object' ? (p.name?.vi || p.name?.en || "") : (p.name || "");
                  return nameStr.toLowerCase().includes(text.toLowerCase());
                });
                setFilteredPois(filtered); setIsDropdownVisible(true);
              }}
            />
          </View>
        </View>
        {isDropdownVisible && (
          <View style={styles.dropdown}>
            <FlatList
              data={filteredPois} keyExtractor={(item) => item.id.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.dropItem} onPress={() => {
                  setSelectedPoi(item); setIsDropdownVisible(false); setSearchQuery("");
                  mapRef.current?.animateToRegion({ latitude: parseFloat(item.latitude), longitude: parseFloat(item.longitude), latitudeDelta: 0.005, longitudeDelta: 0.005 }, 1000);
                }}>
                  <Ionicons name="location-outline" size={16} color="#FF6F00" />
                  <Text style={styles.dropItemText}> {typeof item.name === 'object' ? (item.name?.vi || item.name?.en) : item.name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}
      </View>

      <MapView 
        ref={mapRef} style={styles.map} provider={PROVIDER_GOOGLE}
        onPress={(e) => setUserLocation(e.nativeEvent.coordinate)}
        initialRegion={{ latitude: 10.7712, longitude: 106.6901, latitudeDelta: 0.05, longitudeDelta: 0.05 }}
      >
        {userLocation && (
          <Marker coordinate={userLocation}>
            <View style={styles.userLocationMarker}>
              <View style={styles.userLocationDot} />
            </View>
          </Marker>
        )}
        {pois.map((p) => (
          <React.Fragment key={p.id}>
            <Circle center={{ latitude: parseFloat(p.latitude), longitude: parseFloat(p.longitude) }} radius={100} strokeColor="rgba(255, 111, 0, 0.4)" fillColor="rgba(255, 111, 0, 0.15)" />
            <Marker coordinate={{ latitude: parseFloat(p.latitude), longitude: parseFloat(p.longitude) }} onPress={() => {
                const dist = getDistance(parseFloat(userLocation.latitude), parseFloat(userLocation.longitude), parseFloat(p.latitude), parseFloat(p.longitude));
                if (dist <= 100) {
                    lastPlayedPoiId.current = p.id;
                    setSelectedPoi(p);
                    handleAutoTranslate(p, true); 
                } else {
                    setSelectedPoi(p);
                }
            }}>
              <View style={[styles.customMarker, selectedPoi?.id === p.id && styles.activeMarker]}>
                <Ionicons name="restaurant" size={14} color={selectedPoi?.id === p.id ? "#fff" : "#FF6F00"} />
              </View>
            </Marker>
          </React.Fragment>
        ))}
      </MapView>

      {/* INFO BOTTOM SHEET UPGRADED */}
      <View style={styles.infoContainer}>
        <View style={styles.handle} />
        <ScrollView contentContainerStyle={{padding: 20}}>
          <View style={styles.infoTopRow}>
            <View style={styles.badge}><Text style={styles.badgeText}>{selectedPoi?.type || 'POI'}</Text></View>
            {selectedPoi && <Text style={styles.distanceText}>{getDistance(userLocation.latitude, userLocation.longitude, parseFloat(selectedPoi.latitude), parseFloat(selectedPoi.longitude)).toFixed(0)}m</Text>}
          </View>
          <Text style={styles.poiName}>{translatedData.name || 'Chào mừng!'}</Text>
          <View style={styles.divider} />
          <Text style={styles.descLabel}>{uiLabels.details}</Text>
          {isTranslating ? <ActivityIndicator size="small" color="#FF6F00" /> : <Text style={styles.poiDesc}>{translatedData.desc || 'Chọn một địa điểm trên bản đồ để khám phá câu chuyện và nghe thuyết minh tự động.'}</Text>}
          
          <TouchableOpacity style={[styles.audioBtn, isSpeaking && styles.audioBtnActive]} onPress={handleToggleSpeech}>
            <Ionicons name={isSpeaking ? "stop-circle" : "volume-high"} size={24} color={isSpeaking ? "#fff" : "#FF6F00"} />
            <Text style={[styles.audioBtnText, isSpeaking && {color: '#fff'}]}> {isSpeaking ? uiLabels.stop : uiLabels.listen}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* SIDE MENU MODAL UPGRADED */}
      <Modal visible={isMenuVisible} animationType="fade" transparent>
        <View style={styles.menuOverlay}>
          <View style={styles.menuSideBar}>
            <View style={styles.menuHeader}>
              <View style={styles.avatarCircle}>
                <Text style={styles.avatarText}>{userData.name.charAt(0).toUpperCase()}</Text>
              </View>
              <Text style={styles.menuName}>{userData.name}</Text>
              <Text style={styles.menuEmail}>{userData.email}</Text>
            </View>
            <View style={styles.menuBody}>
              <TouchableOpacity style={styles.menuItem} onPress={() => { setIsMenuVisible(false); navigation.navigate('Profile', { currentLang: lang }); }}>
                <Ionicons name="person-circle-outline" size={24} color="#555" style={styles.menuItemIcon} />
                <Text style={styles.menuItemText}>{uiLabels.profileLink}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => { setIsMenuVisible(false); 
                if (!permission?.granted) requestPermission(); else setIsScannerVisible(true); setScanned(false);
              }}>
                <Ionicons name="qr-code-outline" size={24} color="#555" style={styles.menuItemIcon} />
                <Text style={styles.menuItemText}>{uiLabels.scanQR}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.menuItem} onPress={() => { setIsMenuVisible(false); setIsLangModalVisible(true); }}>
                <Text style={[styles.menuItemIcon, {fontSize: 20}]}>{lang.flag}</Text>
                <Text style={styles.menuItemText}>{uiLabels.langTitle}</Text>
              </TouchableOpacity>
              <View style={styles.menuSpacer} />
              <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
                <Ionicons name="log-out-outline" size={24} color="#FF3B30" style={styles.menuItemIcon} />
                <Text style={[styles.menuItemText, {color: '#FF3B30'}]}>{uiLabels.logout}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <TouchableOpacity style={{flex:1}} activeOpacity={1} onPress={() => setIsMenuVisible(false)} />
        </View>
      </Modal>

      {/* LANGUAGE MODAL UPGRADED */}
      <Modal visible={isLangModalVisible} animationType="fade" transparent>
        <TouchableOpacity style={styles.modalBg} activeOpacity={1} onPress={() => setIsLangModalVisible(false)}>
          <TouchableWithoutFeedback><View style={styles.modalContent}>
              <Text style={styles.modalTitle}>{uiLabels.langTitle}</Text>
              <FlatList data={LANGUAGES} numColumns={2} keyExtractor={(i) => i.code} renderItem={({ item }) => (
                  <TouchableOpacity style={[styles.langGridItem, lang.code === item.code && styles.langGridItemActive]} 
                    onPress={() => { setLang(item); setIsLangModalVisible(false); Speech.stop(); }}>
                    <Text style={{fontSize: 32}}>{item.flag}</Text>
                    <Text style={styles.langNameText}>{item.name}</Text>
                    {lang.code === item.code && <Ionicons name="checkmark-circle" size={20} color="#FF6F00" style={styles.checkIcon} />}
                  </TouchableOpacity>
                )}
              /></View>
          </TouchableWithoutFeedback>
        </TouchableOpacity>
      </Modal>

      {/* SCANNER MODAL UPGRADED */}
      <Modal visible={isScannerVisible} animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          <CameraView onBarcodeScanned={scanned ? undefined : handleBarCodeScanned} style={StyleSheet.absoluteFillObject} barcodeScannerSettings={{ barcodeTypes: ["qr"] }} />
          <View style={styles.scannerOverlay}>
            <View style={styles.scanTarget} />
            <Text style={styles.scanText}>Đặt mã QR vào khung hình để quét</Text>
            <TouchableOpacity style={styles.closeScannerBtn} onPress={() => setIsScannerVisible(false)}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8f9fa" },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchSection: { position: 'absolute', top: 60, left: 20, right: 20, zIndex: 10 },
  topRow: { flexDirection: 'row', alignItems: 'center' },
  searchBar: { flex: 1, flexDirection: 'row', backgroundColor: '#fff', borderRadius: 15, height: 50, alignItems: 'center', paddingHorizontal: 15, marginLeft: 12, elevation: 8, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.1, shadowRadius: 8 },
  input: { flex: 1, fontSize: 15, marginLeft: 10, color: '#333' },
  roundBtn: { width: 50, height: 50, backgroundColor: '#fff', borderRadius: 15, justifyContent: 'center', alignItems: 'center', elevation: 8, shadowColor: '#000', shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.1, shadowRadius: 8 },
  dropdown: { backgroundColor: '#fff', borderRadius: 15, marginTop: 8, elevation: 10, maxHeight: 250, padding: 5 },
  dropItem: { flexDirection: 'row', alignItems: 'center', padding: 15, borderBottomWidth: 0.5, borderBottomColor: '#F0F0F0' },
  dropItemText: { fontWeight: '500', color: '#333' },
  map: { width: width, height: height * 0.7 },
  
  // Custom User Marker
  userLocationMarker: { width: 30, height: 30, backgroundColor: 'rgba(0, 122, 255, 0.2)', borderRadius: 15, justifyContent: 'center', alignItems: 'center' },
  userLocationDot: { width: 14, height: 14, backgroundColor: '#007AFF', borderRadius: 7, borderSize: 3, borderColor: '#fff' },

  customMarker: { backgroundColor: '#fff', padding: 8, borderRadius: 12, borderWidth: 1, borderColor: '#FF6F00', justifyContent: 'center', alignItems: 'center', elevation: 5 },
  activeMarker: { backgroundColor: '#FF6F00', borderColor: '#fff' },
  
  infoContainer: { flex: 1, backgroundColor: "#fff", borderTopLeftRadius: 35, borderTopRightRadius: 35, marginTop: -40, elevation: 30, shadowColor: '#000', shadowOffset: {width: 0, height: -10}, shadowOpacity: 0.1, shadowRadius: 15 },
  handle: { width: 50, height: 5, backgroundColor: '#E0E0E0', borderRadius: 5, alignSelf: 'center', marginTop: 12 },
  infoTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  distanceText: { color: '#999', fontSize: 12, fontWeight: '600' },
  badge: { backgroundColor: '#FFF3E0', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
  badgeText: { color: '#FF6F00', fontSize: 11, fontWeight: 'bold', textTransform: 'uppercase' },
  poiName: { fontSize: 24, fontWeight: 'bold', color: '#2D3436', marginBottom: 5 },
  divider: { height: 1, backgroundColor: '#F1F2F6', marginVertical: 15 },
  descLabel: { fontSize: 11, color: '#B2BEC3', marginBottom: 8, fontWeight: 'bold', letterSpacing: 1 },
  poiDesc: { fontSize: 15, color: '#636E72', lineHeight: 24, marginBottom: 25 },
  audioBtn: { flexDirection: 'row', backgroundColor: '#FFF3E0', padding: 16, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FF6F00' },
  audioBtnActive: { backgroundColor: '#FF6F00' },
  audioBtnText: { color: '#FF6F00', fontWeight: 'bold', fontSize: 16 },

  // Sidebar Menu
  menuOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', flexDirection: 'row' },
  menuSideBar: { width: width * 0.8, backgroundColor: '#fff', height: '100%', borderTopRightRadius: 30, borderBottomRightRadius: 30, overflow: 'hidden' },
  menuHeader: { padding: 30, paddingTop: 70, backgroundColor: '#FFF3E0', alignItems: 'center' },
  avatarCircle: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#FF6F00', justifyContent: 'center', alignItems: 'center', marginBottom: 15, borderWidth: 4, borderColor: '#fff', elevation: 10 },
  avatarText: { color: '#fff', fontSize: 38, fontWeight: 'bold' },
  menuName: { fontSize: 22, fontWeight: 'bold', color: '#2D3436' },
  menuEmail: { color: '#636E72', fontSize: 13, marginTop: 4 },
  menuBody: { padding: 20, flex: 1 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 10, borderRadius: 12, marginBottom: 5 },
  menuItemIcon: { marginRight: 15 },
  menuItemText: { fontSize: 16, fontWeight: '600', color: '#2D3436' },
  menuSpacer: { flex: 1 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', paddingVertical: 18, paddingHorizontal: 10, borderTopWidth: 1, borderTopColor: '#F1F2F6' },
  
  // Modals
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: '#fff', borderRadius: 30, padding: 25, width: '90%', maxHeight: '75%', elevation: 20 },
  modalTitle: { textAlign: 'center', fontWeight: 'bold', marginBottom: 20, fontSize: 18, color: '#2D3436' },
  langGridItem: { flex: 1, alignItems: 'center', paddingVertical: 20, margin: 8, borderRadius: 20, borderWidth: 1.5, borderColor: '#F1F2F6', backgroundColor: '#FAFAFA', position: 'relative' },
  langGridItemActive: { backgroundColor: '#FFF3E0', borderColor: '#FF6F00' },
  langNameText: { fontSize: 13, marginTop: 10, fontWeight: 'bold', color: '#2D3436' },
  checkIcon: { position: 'absolute', top: 8, right: 8 },

  // Scanner
  scannerOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  scanTarget: { width: 250, height: 250, borderWidth: 2, borderColor: '#FF6F00', borderRadius: 30, borderStyle: 'dashed' },
  scanText: { color: '#fff', marginTop: 30, fontSize: 16, fontWeight: '500' },
  closeScannerBtn: { position: 'absolute', top: 60, right: 30, backgroundColor: 'rgba(255,111,0,0.8)', padding: 12, borderRadius: 30 }
});