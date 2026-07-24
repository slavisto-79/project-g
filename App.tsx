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

type InterviewAnswer = {
  label: string;
  value: string;
};

type InterviewQuestion = {
  id: string;
  kicker: string;
  title: string;
  subtitle: string;
  answers: InterviewAnswer[];
};

const interviewQuestions: InterviewQuestion[] = [
  {
    id: "goal",
    kicker: "LET’S START WITH YOUR GOAL",
    title: "What do you want to achieve?",
    subtitle: "Your plan will be built around the result that matters most to you.",
    answers: [
      { label: "Build muscle", value: "muscle" },
      { label: "Lose body fat", value: "fat-loss" },
      { label: "Get stronger", value: "strength" },
      { label: "Improve fitness", value: "fitness" },
      { label: "Feel healthier", value: "health" },
    ],
  },
  {
    id: "experience",
    kicker: "YOUR TRAINING BACKGROUND",
    title: "How experienced are you?",
    subtitle: "There are no wrong answers. We’ll meet you exactly where you are.",
    answers: [
      { label: "I’m just starting", value: "beginner" },
      { label: "Less than 1 year", value: "novice" },
      { label: "1–3 years", value: "intermediate" },
      { label: "More than 3 years", value: "advanced" },
    ],
  },
  {
    id: "frequency",
    kicker: "YOUR WEEKLY RHYTHM",
    title: "How often can you train?",
    subtitle: "Consistency beats perfection. Choose a schedule you can actually maintain.",
    answers: [
      { label: "2 days a week", value: "2" },
      { label: "3 days a week", value: "3" },
      { label: "4 days a week", value: "4" },
      { label: "5+ days a week", value: "5" },
    ],
  },
  {
    id: "duration",
    kicker: "MAKE EVERY MINUTE COUNT",
    title: "How long can each workout be?",
    subtitle: "We’ll optimize the program around your available time.",
    answers: [
      { label: "20–30 minutes", value: "30" },
      { label: "35–45 minutes", value: "45" },
      { label: "50–60 minutes", value: "60" },
      { label: "More than 60 minutes", value: "75" },
    ],
  },
  {
    id: "equipment",
    kicker: "WHERE YOU TRAIN",
    title: "What equipment can you use?",
    subtitle: "Every exercise will match what is genuinely available to you.",
    answers: [
      { label: "Full gym", value: "gym" },
      { label: "Home gym", value: "home-gym" },
      { label: "Dumbbells and bands", value: "minimal" },
      { label: "Bodyweight only", value: "bodyweight" },
    ],
  },
  {
    id: "limitations",
    kicker: "TRAIN SMARTER, NOT THROUGH PAIN",
    title: "Do you have any limitations?",
    subtitle: "Your coach will adapt movements around your needs. This is not medical advice.",
    answers: [
      { label: "No current limitations", value: "none" },
      { label: "Shoulder sensitivity", value: "shoulder" },
      { label: "Back sensitivity", value: "back" },
      { label: "Knee sensitivity", value: "knee" },
      { label: "I’ll discuss it with my coach", value: "coach-review" },
    ],
  },
];

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

function InterviewScreen({ onBack }: { onBack: () => void }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [complete, setComplete] = useState(false);
  const [planStage, setPlanStage] = useState<"review" | "generating" | "ready">("review");
  const question = interviewQuestions[step];
  const selected = question ? answers[question.id] : undefined;
  const progress = complete ? 1 : (step + 1) / interviewQuestions.length;
  const goalLabels: Record<string, string> = {
    muscle: "Build muscle",
    "fat-loss": "Lose body fat",
    strength: "Get stronger",
    fitness: "Improve fitness",
    health: "Feel healthier",
  };
  const equipmentLabels: Record<string, string> = {
    gym: "Full gym",
    "home-gym": "Home gym",
    minimal: "Dumbbells + bands",
    bodyweight: "Bodyweight",
  };

  useEffect(() => {
    if (planStage !== "generating") return;
    const timer = setTimeout(() => setPlanStage("ready"), 2300);
    return () => clearTimeout(timer);
  }, [planStage]);

  const selectAnswer = (value: string) => {
    if (!question) return;
    setAnswers((current) => ({ ...current, [question.id]: value }));
  };

  const goBack = () => {
    if (complete) {
      if (planStage !== "review") {
        setPlanStage("review");
        return;
      }
      setComplete(false);
      setStep(interviewQuestions.length - 1);
      return;
    }
    if (step === 0) {
      onBack();
      return;
    }
    setStep((current) => current - 1);
  };

  const goNext = () => {
    if (!selected) return;
    if (step === interviewQuestions.length - 1) {
      setComplete(true);
      return;
    }
    setStep((current) => current + 1);
  };

  return (
    <SafeAreaView style={styles.preview}>
      <View style={styles.interviewHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="Go back" onPress={goBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹</Text>
        </Pressable>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${progress * 100}%` }]} />
        </View>
        <Text style={styles.progressText}>{complete ? "READY" : `${step + 1}/${interviewQuestions.length}`}</Text>
      </View>

      {complete && planStage === "ready" ? (
        <View style={styles.planContent}>
          <Text style={styles.completeKicker}>YOUR PLAN IS READY</Text>
          <Text style={styles.planTitle}>
            Built for <Text style={styles.welcomeTitleAccent}>you.</Text>
          </Text>
          <Text style={styles.completeBody}>
            A focused first week based on your goal, schedule, equipment, and recovery needs.
          </Text>

          <View style={styles.planHeroCard}>
            <View style={styles.planHeroTop}>
              <View>
                <Text style={styles.planMetaLabel}>WEEK 01 · FOUNDATION</Text>
                <Text style={styles.planName}>{goalLabels[answers.goal ?? ""] ?? "Personal training"}</Text>
              </View>
              <View style={styles.aiBadge}>
                <Text style={styles.aiBadgeText}>AI + COACH</Text>
              </View>
            </View>
            <View style={styles.planStats}>
              <View style={styles.planStat}>
                <Text style={styles.planStatValue}>{answers.frequency ?? "3"}×</Text>
                <Text style={styles.planStatLabel}>WEEKLY</Text>
              </View>
              <View style={styles.planStatDivider} />
              <View style={styles.planStat}>
                <Text style={styles.planStatValue}>{answers.duration ?? "45"}</Text>
                <Text style={styles.planStatLabel}>MINUTES</Text>
              </View>
              <View style={styles.planStatDivider} />
              <View style={styles.planStat}>
                <Text style={styles.planStatValue}>01</Text>
                <Text style={styles.planStatLabel}>COACH REVIEW</Text>
              </View>
            </View>
          </View>

          <Text style={styles.planSectionTitle}>YOUR FIRST SESSION</Text>
          <View style={styles.sessionCard}>
            <View style={styles.sessionNumber}><Text style={styles.sessionNumberText}>01</Text></View>
            <View style={styles.sessionCopy}>
              <Text style={styles.sessionTitle}>Full Body Foundation</Text>
              <Text style={styles.sessionMeta}>
                {answers.duration ?? "45"} min · {equipmentLabels[answers.equipment ?? ""] ?? "Your equipment"} · 6 exercises
              </Text>
            </View>
            <Text style={styles.sessionArrow}>›</Text>
          </View>

          <Pressable style={styles.startButton}>
            <Text style={styles.startButtonText}>ENTER MY DASHBOARD</Text>
            <Text style={styles.startArrow}>↗</Text>
          </Pressable>
        </View>
      ) : complete && planStage === "generating" ? (
        <View style={styles.generatingContent}>
          <View style={styles.analysisOrb}>
            <BrandMark size={72} />
            <View style={styles.analysisRing} />
          </View>
          <Text style={styles.completeKicker}>BUILDING YOUR PROGRAM</Text>
          <Text style={styles.generatingTitle}>Turning your life into a plan.</Text>
          <View style={styles.analysisList}>
            {["Goal and experience", "Schedule and equipment", "Safety and recovery", "Coach review layer"].map(
              (item, index) => (
                <View style={styles.analysisRow} key={item}>
                  <View style={styles.analysisCheck}><Text style={styles.analysisCheckText}>✓</Text></View>
                  <Text style={styles.analysisText}>{item}</Text>
                  <Text style={styles.analysisState}>{index < 3 ? "ANALYZED" : "PREPARING"}</Text>
                </View>
              ),
            )}
          </View>
        </View>
      ) : complete ? (
        <View style={styles.completeContent}>
          <BrandMark size={68} />
          <Text style={styles.completeKicker}>YOUR PROFILE IS READY</Text>
          <Text style={styles.completeTitle}>We know where to begin.</Text>
          <Text style={styles.completeBody}>
            Your answers are ready for AI analysis and a real coach review. Next, we’ll turn them
            into your first adaptive training plan.
          </Text>
          <View style={styles.completeCard}>
            <View style={styles.completeRow}>
              <Text style={styles.completeLabel}>PROFILE SIGNALS</Text>
              <Text style={styles.completeValue}>{Object.keys(answers).length} collected</Text>
            </View>
            <View style={styles.completeDivider} />
            <View style={styles.completeRow}>
              <Text style={styles.completeLabel}>HUMAN REVIEW</Text>
              <Text style={styles.completeValue}>Included</Text>
            </View>
          </View>
          <Pressable onPress={() => setPlanStage("generating")} style={styles.startButton}>
            <Text style={styles.startButtonText}>CREATE MY PLAN</Text>
            <Text style={styles.startArrow}>↗</Text>
          </Pressable>
        </View>
      ) : question ? (
        <>
          <View style={styles.questionContent}>
            <Text style={styles.previewStep}>{question.kicker}</Text>
            <Text style={styles.previewTitle}>{question.title}</Text>
            <Text style={styles.previewBody}>{question.subtitle}</Text>
            <View style={styles.answerList}>
              {question.answers.map((answer) => {
                const isSelected = answer.value === selected;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    key={answer.value}
                    onPress={() => selectAnswer(answer.value)}
                    style={({ pressed }) => [
                      styles.answerCard,
                      isSelected && styles.answerCardSelected,
                      pressed && styles.answerCardPressed,
                    ]}
                  >
                    <View style={[styles.answerRadio, isSelected && styles.answerRadioSelected]}>
                      {isSelected ? <View style={styles.answerRadioDot} /> : null}
                    </View>
                    <Text style={[styles.answerText, isSelected && styles.answerTextSelected]}>
                      {answer.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View style={styles.interviewFooter}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continue"
              disabled={!selected}
              onPress={goNext}
              style={({ pressed }) => [
                styles.continueButton,
                !selected && styles.continueButtonDisabled,
                pressed && selected ? styles.startButtonPressed : null,
              ]}
            >
              <Text style={[styles.continueButtonText, !selected && styles.continueButtonTextDisabled]}>
                CONTINUE
              </Text>
              <Text style={[styles.continueArrow, !selected && styles.continueButtonTextDisabled]}>→</Text>
            </Pressable>
          </View>
        </>
      ) : null}
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
      {screen === "interview" && <InterviewScreen onBack={() => setScreen("welcome")} />}
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
  interviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingTop: Platform.OS === "android" ? 12 : 2,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#292C28",
  },
  backButtonText: { color: colors.text, fontSize: 34, lineHeight: 37, marginTop: -3 },
  progressTrack: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    marginHorizontal: 15,
    backgroundColor: "#222520",
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 2, backgroundColor: colors.lime },
  progressText: {
    width: 42,
    color: colors.muted,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.1,
    textAlign: "right",
  },
  questionContent: { flex: 1, paddingHorizontal: 24, paddingTop: 34 },
  previewStep: {
    color: colors.lime,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 16,
  },
  previewTitle: {
    color: colors.text,
    fontSize: 38,
    lineHeight: 42,
    fontWeight: "700",
    letterSpacing: -1.8,
  },
  previewBody: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 14, maxWidth: 480 },
  answerList: { marginTop: 24, gap: 10 },
  answerCard: {
    minHeight: 58,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#262A24",
    backgroundColor: "#0C0E0C",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 17,
  },
  answerCardSelected: {
    borderColor: "rgba(200,255,50,0.72)",
    backgroundColor: "rgba(200,255,50,0.08)",
  },
  answerCardPressed: { opacity: 0.8 },
  answerRadio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#555B52",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  answerRadioSelected: { borderColor: colors.lime },
  answerRadioDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.lime },
  answerText: { color: "#CFD3CC", fontSize: 15, fontWeight: "600" },
  answerTextSelected: { color: colors.text },
  interviewFooter: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 20 },
  continueButton: {
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.lime,
    paddingHorizontal: 21,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  continueButtonDisabled: { backgroundColor: "#171A16" },
  continueButtonText: { color: colors.ink, fontSize: 12, fontWeight: "900", letterSpacing: 1.3 },
  continueButtonTextDisabled: { color: "#555A52" },
  continueArrow: { color: colors.ink, fontSize: 20 },
  completeContent: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 32,
  },
  completeKicker: {
    color: colors.lime,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 2,
    marginTop: 30,
    marginBottom: 12,
  },
  completeTitle: {
    color: colors.text,
    fontSize: 40,
    lineHeight: 43,
    fontWeight: "700",
    letterSpacing: -1.8,
  },
  completeBody: { color: colors.muted, fontSize: 15, lineHeight: 23, marginTop: 16, marginBottom: 24 },
  completeCard: {
    borderRadius: 18,
    padding: 18,
    marginBottom: 22,
    borderWidth: 1,
    borderColor: "#272B25",
    backgroundColor: "#0E100E",
  },
  completeRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  completeLabel: { color: colors.muted, fontSize: 9, fontWeight: "800", letterSpacing: 1.3 },
  completeValue: { color: colors.text, fontSize: 13, fontWeight: "700" },
  completeDivider: { height: 1, backgroundColor: "#242823", marginVertical: 15 },
  generatingContent: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 52,
  },
  analysisOrb: {
    width: 116,
    height: 116,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  analysisRing: {
    position: "absolute",
    width: 112,
    height: 112,
    borderRadius: 56,
    borderWidth: 1,
    borderColor: "rgba(200,255,50,0.18)",
  },
  generatingTitle: {
    color: colors.text,
    fontSize: 38,
    lineHeight: 42,
    fontWeight: "700",
    letterSpacing: -1.7,
    maxWidth: 430,
  },
  analysisList: {
    marginTop: 30,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#242824",
    backgroundColor: "#0C0E0C",
    overflow: "hidden",
  },
  analysisRow: {
    minHeight: 56,
    paddingHorizontal: 15,
    flexDirection: "row",
    alignItems: "center",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#252825",
  },
  analysisCheck: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    backgroundColor: "rgba(200,255,50,0.13)",
  },
  analysisCheckText: { color: colors.lime, fontSize: 12, fontWeight: "900" },
  analysisText: { color: colors.text, fontSize: 13, fontWeight: "600", flex: 1 },
  analysisState: { color: colors.muted, fontSize: 8, fontWeight: "800", letterSpacing: 1 },
  planContent: { flex: 1, justifyContent: "center", paddingHorizontal: 24, paddingBottom: 26 },
  planTitle: {
    color: colors.text,
    fontSize: 43,
    lineHeight: 46,
    fontWeight: "700",
    letterSpacing: -2,
  },
  planHeroCard: {
    borderRadius: 22,
    padding: 18,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(200,255,50,0.28)",
    backgroundColor: "#11150E",
  },
  planHeroTop: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  planMetaLabel: { color: colors.lime, fontSize: 8, fontWeight: "800", letterSpacing: 1.3 },
  planName: { color: colors.text, fontSize: 21, fontWeight: "700", marginTop: 6 },
  aiBadge: {
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 12,
    backgroundColor: "rgba(200,255,50,0.12)",
  },
  aiBadgeText: { color: colors.lime, fontSize: 7, fontWeight: "900", letterSpacing: 1 },
  planStats: { flexDirection: "row", alignItems: "center", marginTop: 24 },
  planStat: { flex: 1 },
  planStatValue: { color: colors.text, fontSize: 22, fontWeight: "800" },
  planStatLabel: { color: colors.muted, fontSize: 7, fontWeight: "800", letterSpacing: 1, marginTop: 3 },
  planStatDivider: { width: 1, height: 28, backgroundColor: "#34392F", marginHorizontal: 12 },
  planSectionTitle: { color: colors.muted, fontSize: 8, fontWeight: "800", letterSpacing: 1.5, marginBottom: 10 },
  sessionCard: {
    minHeight: 72,
    borderRadius: 18,
    paddingHorizontal: 14,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#272A27",
    backgroundColor: "#0D0F0D",
  },
  sessionNumber: {
    width: 40,
    height: 40,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lime,
  },
  sessionNumberText: { color: colors.ink, fontSize: 12, fontWeight: "900" },
  sessionCopy: { flex: 1, marginLeft: 13 },
  sessionTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  sessionMeta: { color: colors.muted, fontSize: 10, marginTop: 5 },
  sessionArrow: { color: colors.muted, fontSize: 25 },
});
