import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  ImageBackground,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";

const colors = {
  background: "#050505",
  surface: "#111311",
  text: "#F4F7F2",
  muted: "#A7ADA5",
  lime: "#C8FF32",
  ink: "#0A0B09",
};

type Screen = "splash" | "welcome" | "interview";

function BrandMark({ size = 92 }: { size?: number }) {
  return (
    <View style={[styles.mark, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[styles.markLetter, { fontSize: size * 0.5 }]}>G</Text>
      <View style={styles.markDot} />
    </View>
  );
}

function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.88)).current;
  const copyOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 650,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.spring(scale, {
          toValue: 1,
          damping: 14,
          stiffness: 120,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(copyOpacity, {
        toValue: 1,
        duration: 550,
        useNativeDriver: true,
      }),
      Animated.delay(850),
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 350,
          useNativeDriver: true,
        }),
        Animated.timing(copyOpacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]),
    ]).start(onComplete);
  }, [copyOpacity, onComplete, opacity, scale]);

  return (
    <SafeAreaView style={styles.splash}>
      <View style={styles.splashGlow} />
      <Animated.View style={{ opacity, transform: [{ scale }] }}>
        <BrandMark />
      </Animated.View>
      <Animated.View style={[styles.splashCopy, { opacity: copyOpacity }]}>
        <Text style={styles.splashTitle}>PROJECT G</Text>
        <Text style={styles.splashTagline}>POWERED BY AI · GUIDED BY A REAL COACH</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

function WelcomeScreen({ onStart }: { onStart: () => void }) {
  const contentY = useRef(new Animated.Value(26)).current;
  const contentOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(contentY, {
        toValue: 0,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(contentOpacity, {
        toValue: 1,
        duration: 650,
        useNativeDriver: true,
      }),
    ]).start();
  }, [contentOpacity, contentY]);

  return (
    <ImageBackground
      source={require("./assets/welcome-hero.png")}
      resizeMode="cover"
      style={styles.welcomeImage}
      imageStyle={styles.welcomeImageAsset}
    >
      <View style={styles.topShade} />
      <View style={styles.bottomShade} />
      <SafeAreaView style={styles.welcomeSafe}>
        <View style={styles.welcomeHeader}>
          <View style={styles.miniMark}>
            <Text style={styles.miniMarkText}>G</Text>
          </View>
          <Text style={styles.wordmark}>PROJECT G</Text>
          <View style={styles.humanBadge}>
            <View style={styles.liveDot} />
            <Text style={styles.humanBadgeText}>HUMAN BACKED</Text>
          </View>
        </View>

        <Animated.View
          style={[
            styles.welcomeContent,
            { opacity: contentOpacity, transform: [{ translateY: contentY }] },
          ]}
        >
          <Text style={styles.eyebrow}>YOUR PERSONAL PERFORMANCE SYSTEM</Text>
          <Text style={styles.welcomeTitle}>
            Become the{"\n"}
            <Text style={styles.welcomeTitleAccent}>strongest</Text> version{"\n"}of yourself.
          </Text>
          <Text style={styles.welcomeBody}>
            AI builds the plan. A real coach helps you achieve it.
          </Text>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Get started"
            onPress={onStart}
            style={({ pressed }) => [styles.startButton, pressed && styles.startButtonPressed]}
          >
            <Text style={styles.startButtonText}>GET STARTED</Text>
            <Text style={styles.startArrow}>↗</Text>
          </Pressable>
          <Text style={styles.disclaimer}>Built for your goals. Adapted to your life.</Text>
        </Animated.View>
      </SafeAreaView>
    </ImageBackground>
  );
}

function InterviewPreview({ onBack }: { onBack: () => void }) {
  return (
    <SafeAreaView style={styles.preview}>
      <Pressable onPress={onBack} style={styles.backButton}>
        <Text style={styles.backButtonText}>‹</Text>
      </Pressable>
      <View style={styles.previewContent}>
        <Text style={styles.previewStep}>NEXT · AI INTERVIEW</Text>
        <Text style={styles.previewTitle}>Let’s build your plan.</Text>
        <Text style={styles.previewBody}>
          This confirms the approved Welcome flow is connected. The conversational AI interview is
          the next screen we’ll design.
        </Text>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("splash");

  return (
    <View style={styles.app}>
      {Platform.OS === "android" ? <StatusBar backgroundColor={colors.background} /> : null}
      <ExpoStatusBar style="light" />
      {screen === "splash" && <SplashScreen onComplete={() => setScreen("welcome")} />}
      {screen === "welcome" && <WelcomeScreen onStart={() => setScreen("interview")} />}
      {screen === "interview" && <InterviewPreview onBack={() => setScreen("welcome")} />}
    </View>
  );
}

const styles = StyleSheet.create({
  app: { flex: 1, backgroundColor: colors.background },
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.background,
  },
  splashGlow: {
    position: "absolute",
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: "rgba(200,255,50,0.055)",
  },
  mark: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(200,255,50,0.72)",
    backgroundColor: colors.surface,
  },
  markLetter: {
    color: colors.text,
    fontWeight: "800",
    letterSpacing: -2,
  },
  markDot: {
    position: "absolute",
    right: 13,
    top: 15,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.lime,
  },
  splashCopy: { position: "absolute", bottom: 74, alignItems: "center", paddingHorizontal: 24 },
  splashTitle: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 4,
    marginBottom: 12,
  },
  splashTagline: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "600",
    letterSpacing: 1.7,
    textAlign: "center",
  },
  welcomeImage: { flex: 1, backgroundColor: colors.background },
  welcomeImageAsset: { backgroundColor: colors.background },
  topShade: {
    ...StyleSheet.absoluteFillObject,
    bottom: "55%",
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  bottomShade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: "53%",
    backgroundColor: "rgba(0,0,0,0.82)",
  },
  welcomeSafe: { flex: 1, justifyContent: "space-between" },
  welcomeHeader: {
    marginTop: Platform.OS === "android" ? 14 : 4,
    paddingHorizontal: 24,
    flexDirection: "row",
    alignItems: "center",
  },
  miniMark: {
    width: 31,
    height: 31,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.lime,
    marginRight: 10,
  },
  miniMarkText: { color: colors.text, fontSize: 15, fontWeight: "800" },
  wordmark: { color: colors.text, fontSize: 11, fontWeight: "800", letterSpacing: 2.2 },
  humanBadge: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    paddingHorizontal: 10,
    borderRadius: 18,
    backgroundColor: "rgba(10,12,9,0.70)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.13)",
  },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.lime, marginRight: 7 },
  humanBadgeText: { color: colors.text, fontSize: 8, fontWeight: "700", letterSpacing: 1.1 },
  welcomeContent: { paddingHorizontal: 24, paddingBottom: 24 },
  eyebrow: {
    color: colors.lime,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 1.8,
    marginBottom: 14,
  },
  welcomeTitle: {
    maxWidth: 520,
    color: colors.text,
    fontSize: 45,
    lineHeight: 48,
    letterSpacing: -2.2,
    fontWeight: "700",
  },
  welcomeTitleAccent: { color: colors.lime },
  welcomeBody: {
    color: "#C7CBC4",
    maxWidth: 390,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 17,
    marginBottom: 24,
  },
  startButton: {
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.lime,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  startButtonPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  startButtonText: { color: colors.ink, fontSize: 13, fontWeight: "900", letterSpacing: 1.35 },
  startArrow: { color: colors.ink, fontSize: 23, fontWeight: "500" },
  disclaimer: { color: "#7D827A", fontSize: 10, textAlign: "center", marginTop: 13 },
  preview: { flex: 1, backgroundColor: colors.background },
  backButton: {
    margin: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#292C28",
  },
  backButtonText: { color: colors.text, fontSize: 34, lineHeight: 37, marginTop: -3 },
  previewContent: { flex: 1, justifyContent: "center", padding: 28 },
  previewStep: {
    color: colors.lime,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 16,
  },
  previewTitle: {
    color: colors.text,
    fontSize: 42,
    lineHeight: 46,
    fontWeight: "700",
    letterSpacing: -1.8,
  },
  previewBody: { color: colors.muted, fontSize: 16, lineHeight: 25, marginTop: 18, maxWidth: 480 },
});
