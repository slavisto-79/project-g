import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native";
import { StatusBar as ExpoStatusBar } from "expo-status-bar";
import { useVideoPlayer, VideoView } from "expo-video";

const colors = {
  background: "#050505",
  surface: "#111311",
  text: "#F4F7F2",
  muted: "#A7ADA5",
  lime: "#C8FF32",
  ink: "#0A0B09",
};

type Screen = "splash" | "welcome" | "interview" | "dashboard" | "workout" | "progress" | "coach";

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
    id: "sex",
    kicker: "PERSONALIZE YOUR TRAINING",
    title: "How should we personalize your plan?",
    subtitle: "This helps tailor training emphasis and coaching. You can change it later.",
    answers: [
      { label: "Woman", value: "female" },
      { label: "Man", value: "male" },
      { label: "Prefer not to say", value: "neutral" },
    ],
  },
  {
    id: "age",
    kicker: "TRAIN FOR YOUR CURRENT STAGE",
    title: "What is your age range?",
    subtitle: "Age helps us adjust recovery, exercise progression, and training volume.",
    answers: [
      { label: "16–24", value: "16-24" },
      { label: "25–34", value: "25-34" },
      { label: "35–44", value: "35-44" },
      { label: "45–54", value: "45-54" },
      { label: "55+", value: "55-plus" },
    ],
  },
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
    <View style={styles.welcomeImage}>
      <Image
        source={require("./assets/welcome-hero-unisex-v2.png")}
        resizeMode="contain"
        style={styles.welcomeHeroImage}
      />
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

        <ScrollView
          style={styles.welcomeScroll}
          contentContainerStyle={styles.welcomeScrollContent}
          showsVerticalScrollIndicator={false}
          bounces={false}
        >
          <Animated.View
            style={[
              styles.welcomeContent,
              { opacity: contentOpacity, transform: [{ translateY: contentY }] },
            ]}
          >
          <Text style={styles.eyebrow}>
            AI PRECISION.{"\n"}REAL HUMAN COACHING.
          </Text>
          <Text style={styles.welcomeTitle}>
            Become the{"\n"}
            <Text style={styles.welcomeTitleAccent}>strongest</Text> version{"\n"}of yourself.
          </Text>
          <Text style={styles.welcomeBody}>
            Built around your body, your goals, and your real life.
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
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

function InterviewScreen({
  onBack,
  onFinish,
  onStartWorkout,
}: {
  onBack: () => void;
  onFinish: (profile: Record<string, string>) => void;
  onStartWorkout: (profile: Record<string, string>) => void;
}) {
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
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open Full Body Foundation workout"
            onPress={() => onStartWorkout(answers)}
            style={({ pressed }) => [styles.sessionCard, pressed && { opacity: 0.78 }]}
          >
            <View style={styles.sessionNumber}><Text style={styles.sessionNumberText}>01</Text></View>
            <View style={styles.sessionCopy}>
              <Text style={styles.sessionTitle}>Full Body Foundation</Text>
              <Text style={styles.sessionMeta}>
                {answers.duration ?? "45"} min · {equipmentLabels[answers.equipment ?? ""] ?? "Your equipment"} · 5 exercises
              </Text>
            </View>
            <Text style={styles.sessionArrow}>›</Text>
          </Pressable>

          <Pressable onPress={() => onFinish(answers)} style={styles.startButton}>
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

function DashboardScreen({
  onStartWorkout,
  onOpenCoach,
  profile,
}: {
  onStartWorkout: () => void;
  onOpenCoach: () => void;
  profile: Record<string, string>;
}) {
  const workoutName =
    profile.sex === "female"
      ? profile.goal === "strength" ? "Women’s Strength" : "Lower Body + Full Body"
      : profile.sex === "male"
        ? profile.goal === "fat-loss" ? "Metabolic Full Body" : "Strength + Muscle"
        : "Balanced Full Body";

  return (
    <SafeAreaView style={styles.dashboard}>
      <View style={styles.dashboardHeader}>
        <View>
          <Text style={styles.dashboardGreeting}>GOOD MORNING</Text>
          <Text style={styles.dashboardName}>Ready for today?</Text>
        </View>
        <View style={styles.dashboardAvatar}>
          <Text style={styles.dashboardAvatarText}>G</Text>
          <View style={styles.avatarStatus} />
        </View>
      </View>

      <View style={styles.dashboardBody}>
        <View style={styles.workoutCard}>
          <View style={styles.workoutCardTop}>
            <View style={styles.workoutTypeBadge}>
              <Text style={styles.workoutTypeText}>TODAY’S WORKOUT</Text>
            </View>
            <Text style={styles.workoutDuration}>{profile.duration ?? "45"} MIN</Text>
          </View>
          <Text style={styles.workoutTitle}>{workoutName}</Text>
          <Text style={styles.workoutMeta}>5 guided exercises · Personalized intensity</Text>
          <View style={styles.workoutCoachNote}>
            <View style={styles.coachMiniAvatar}><Text style={styles.coachMiniText}>G</Text></View>
            <Text style={styles.workoutCoachText}>Adapted to your profile, recovery, and equipment.</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Start workout"
            onPress={onStartWorkout}
            style={styles.workoutButton}
          >
            <Text style={styles.workoutButtonText}>START WORKOUT</Text>
            <Text style={styles.workoutButtonArrow}>→</Text>
          </Pressable>
        </View>

        <View style={styles.readinessCard}>
          <View style={styles.recoveryScore}>
            <Text style={styles.recoveryValue}>78</Text>
            <Text style={styles.recoveryLabel}>READY</Text>
          </View>
          <View style={styles.readinessCopy}>
            <Text style={styles.sectionEyebrow}>TODAY’S READINESS</Text>
            <Text style={styles.readinessTitle}>Good readiness</Text>
            <Text style={styles.readinessHint}>You’re ready for the planned session.</Text>
          </View>
          <Text style={styles.cardChevron}>›</Text>
        </View>

        <Text style={styles.quickTitle}>QUICK OVERVIEW</Text>
        <View style={styles.metricGrid}>
          {[
            ["1 / 3", "WORKOUTS"],
            ["1,840", "CALORIES"],
            ["128g", "PROTEIN"],
          ].map(([value, label]) => (
            <View style={styles.metricCard} key={label}>
              <Text style={styles.metricValue}>{value}</Text>
              <Text style={styles.metricLabel}>{label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.lastWorkoutCard}>
          <View>
            <Text style={styles.weekLabel}>LAST WORKOUT</Text>
            <Text style={styles.weekValue}>Full Body · 42 min</Text>
          </View>
          <View style={styles.lastWorkoutScore}>
            <Text style={styles.lastWorkoutScoreText}>86%</Text>
          </View>
        </View>
      </View>

      <View style={styles.bottomNav}>
        {[
          ["⌂", "HOME"],
          ["◇", "WORKOUT"],
          ["◉", "NUTRITION"],
          ["↗", "PROGRESS"],
          ["○", "COACH"],
        ].map(([icon, label], index) => (
          <Pressable
            key={label}
            onPress={label === "COACH" ? onOpenCoach : undefined}
            style={styles.navItem}
          >
            <Text style={[styles.navIcon, index === 0 && styles.navActive]}>{icon}</Text>
            <Text style={[styles.navLabel, index === 0 && styles.navActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

type CoachScenario = "tired" | "pain" | "time" | "equipment";

const coachScenarios: Record<
  CoachScenario,
  { label: string; user: string; reply: string; changes: string[] }
> = {
  tired: {
    label: "I feel tired",
    user: "I’m feeling more tired than usual today.",
    reply:
      "Thanks for telling me. I’ll keep the session useful without forcing intensity your recovery cannot support today.",
    changes: ["Reduce working volume by 20%", "Keep technique-focused sets", "Add 30 sec recovery"],
  },
  pain: {
    label: "Something hurts",
    user: "I have some discomfort and need a safer session.",
    reply:
      "We won’t train through pain. I’ll remove aggravating movements and flag this for a real coach review. Stop if symptoms increase.",
    changes: ["Replace sensitive movements", "Use a controlled range", "Request coach review"],
  },
  time: {
    label: "Only 30 minutes",
    user: "I only have 30 minutes to train today.",
    reply:
      "That’s enough for a focused session. I’ll preserve the main work, combine accessories, and remove low-priority volume.",
    changes: ["Keep 3 priority exercises", "Pair accessory movements", "Target 30 min total"],
  },
  equipment: {
    label: "Limited equipment",
    user: "I don’t have access to my usual equipment.",
    reply:
      "No problem. I’ll rebuild today’s session around what you have while keeping the same movement goals.",
    changes: ["Use equipment-free alternatives", "Preserve movement patterns", "Match planned effort"],
  },
};

function AICoachScreen({
  profile,
  onBack,
  onApply,
  onStartWorkout,
}: {
  profile: Record<string, string>;
  onBack: () => void;
  onApply: (scenario: CoachScenario) => void;
  onStartWorkout: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [scenario, setScenario] = useState<CoachScenario | null>(null);
  const [customMessage, setCustomMessage] = useState("");
  const [applied, setApplied] = useState(false);
  const [aiReply, setAiReply] = useState("");
  const [aiChanges, setAiChanges] = useState<string[]>([]);
  const [isThinking, setIsThinking] = useState(false);
  const [coachError, setCoachError] = useState("");
  const scrollRef = useRef<ScrollView>(null);

  const selected = scenario ? coachScenarios[scenario] : null;
  const goalLabel =
    profile.goal === "fat-loss"
      ? "fat-loss"
      : profile.goal === "strength"
        ? "strength"
        : profile.goal === "muscle"
          ? "muscle-building"
          : "fitness";

  const askCoach = async (message: string, fallbackScenario: CoachScenario) => {
    setIsThinking(true);
    setCoachError("");
    setAiReply("");
    setAiChanges([]);
    setApplied(false);
    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, profile }),
      });
      if (!response.ok) throw new Error("Coach request failed");
      const result = (await response.json()) as {
        reply?: string;
        scenario?: CoachScenario | "general";
        changes?: string[];
      };
      const resolvedScenario =
        result.scenario && result.scenario !== "general" ? result.scenario : fallbackScenario;
      setScenario(resolvedScenario);
      setAiReply(result.reply ?? coachScenarios[resolvedScenario].reply);
      setAiChanges(result.changes?.length ? result.changes : coachScenarios[resolvedScenario].changes);
    } catch {
      setScenario(fallbackScenario);
      setAiReply(coachScenarios[fallbackScenario].reply);
      setAiChanges(coachScenarios[fallbackScenario].changes);
      setCoachError("Live AI is unavailable. Safe coaching mode is active.");
    } finally {
      setIsThinking(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  };

  const chooseScenario = (next: CoachScenario) => {
    setScenario(next);
    const message = coachScenarios[next].user;
    setCustomMessage(message);
    void askCoach(message, next);
  };

  const sendCustomMessage = () => {
    const message = draft.trim();
    if (!message) return;
    const normalized = message.toLowerCase();
    const inferredScenario: CoachScenario =
      normalized.includes("pain") || normalized.includes("hurt") || normalized.includes("бол")
        ? "pain"
        : normalized.includes("minute") || normalized.includes("time") || normalized.includes("врем")
          ? "time"
          : normalized.includes("equipment") || normalized.includes("gym") || normalized.includes("уред")
            ? "equipment"
            : "tired";
    setCustomMessage(message);
    setDraft("");
    setScenario(inferredScenario);
    setApplied(false);
    void askCoach(message, inferredScenario);
  };

  return (
    <SafeAreaView style={styles.coachScreen}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.coachKeyboard}
      >
        <View style={styles.coachHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.coachBack}>
            <Text style={styles.coachBackText}>‹</Text>
          </Pressable>
          <View style={styles.coachIdentity}>
            <View style={styles.coachPortrait}><Text style={styles.coachPortraitText}>G</Text></View>
            <View>
              <Text style={styles.coachName}>AI COACH</Text>
              <View style={styles.coachOnlineRow}>
                <View style={styles.coachOnlineDot} />
                <Text style={styles.coachOnlineText}>ONLINE · HUMAN BACKED</Text>
              </View>
            </View>
          </View>
          <View style={styles.coachHeaderSpacer} />
        </View>

        <ScrollView
          ref={scrollRef}
          contentContainerStyle={styles.coachConversation}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.coachContextCard}>
            <Text style={styles.coachContextEyebrow}>TODAY’S CONTEXT</Text>
            <Text style={styles.coachContextTitle}>Your {goalLabel} plan is ready.</Text>
            <Text style={styles.coachContextText}>
              Tell me what changed. I’ll adapt the session while protecting its purpose.
            </Text>
          </View>

          <View style={styles.coachBubbleRow}>
            <View style={styles.coachBubbleMark}><Text style={styles.coachBubbleMarkText}>G</Text></View>
            <View style={styles.coachBubble}>
              <Text style={styles.coachBubbleText}>
                How are you feeling before today’s workout?
              </Text>
            </View>
          </View>

          <View style={styles.coachQuickActions}>
            {(Object.keys(coachScenarios) as CoachScenario[]).map((key) => (
              <Pressable
                key={key}
                onPress={() => chooseScenario(key)}
                style={[styles.coachQuickAction, scenario === key && styles.coachQuickActionActive]}
              >
                <Text style={[styles.coachQuickActionText, scenario === key && styles.coachQuickActionTextActive]}>
                  {coachScenarios[key].label}
                </Text>
              </Pressable>
            ))}
          </View>

          {isThinking ? (
            <View style={styles.coachBubbleRow}>
              <View style={styles.coachBubbleMark}><Text style={styles.coachBubbleMarkText}>G</Text></View>
              <View style={styles.coachBubble}>
                <Text style={styles.coachBubbleText}>Thinking about the safest useful adjustmentâ€¦</Text>
              </View>
            </View>
          ) : null}

          {selected && !isThinking ? (
            <>
              <View style={styles.userBubble}>
                <Text style={styles.userBubbleText}>{customMessage || selected.user}</Text>
              </View>
              <View style={styles.coachBubbleRow}>
                <View style={styles.coachBubbleMark}><Text style={styles.coachBubbleMarkText}>G</Text></View>
                <View style={styles.coachBubble}>
                  <Text style={styles.coachBubbleText}>{aiReply || selected.reply}</Text>
                </View>
              </View>
              {coachError ? <Text style={styles.coachFallbackText}>{coachError}</Text> : null}
              <View style={styles.coachAdjustmentCard}>
                <View style={styles.coachAdjustmentTop}>
                  <Text style={styles.coachAdjustmentLabel}>ADJUSTED WORKOUT</Text>
                  <Text style={styles.coachAdjustmentBadge}>AI PROPOSAL</Text>
                </View>
                {(aiChanges.length ? aiChanges : selected.changes).map((change) => (
                  <View key={change} style={styles.coachChangeRow}>
                    <Text style={styles.coachChangeCheck}>✓</Text>
                    <Text style={styles.coachChangeText}>{change}</Text>
                  </View>
                ))}
                <Pressable
                  onPress={() => {
                    if (!scenario) return;
                    onApply(scenario);
                    setApplied(true);
                  }}
                  disabled={applied}
                  style={[styles.coachApplyButton, applied && styles.coachApplyButtonDone]}
                >
                  <Text style={styles.coachApplyButtonText}>
                    {applied ? "PLAN UPDATED ✓" : "APPLY CHANGES"}
                  </Text>
                </Pressable>
                {applied ? (
                  <Pressable onPress={onStartWorkout} style={styles.coachStartButton}>
                    <Text style={styles.coachStartButtonText}>START ADAPTED WORKOUT</Text>
                    <Text style={styles.coachStartButtonArrow}>→</Text>
                  </Pressable>
                ) : null}
              </View>
            </>
          ) : null}
        </ScrollView>

        <View style={styles.coachComposer}>
          <TextInput
            accessibilityLabel="Message AI Coach"
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={sendCustomMessage}
            placeholder="Message your AI Coach..."
            placeholderTextColor="#747A72"
            returnKeyType="send"
            style={styles.coachInput}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send message"
            onPress={sendCustomMessage}
            disabled={!draft.trim() || isThinking}
            style={[styles.coachSend, (!draft.trim() || isThinking) && styles.coachSendDisabled]}
          >
            <Text style={styles.coachSendText}>↑</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type WorkoutExercise = {
  name: string;
  target: string;
  weight: string;
  reps: string;
  tempo: string;
  phases: string[];
  formFrames: [number, number];
  poseGuide: PoseGuide;
  video?: number;
};

type PoseSegment = [number, number, number, number];
type PoseGuide = {
  start: PoseSegment[];
  finish: PoseSegment[];
};

const poseGuides: Record<string, PoseGuide> = {
  squat: {
    start: [
      [0.5, 0.29, 0.5, 0.49],
      [0.5, 0.36, 0.43, 0.42],
      [0.43, 0.42, 0.47, 0.49],
      [0.5, 0.36, 0.57, 0.42],
      [0.57, 0.42, 0.53, 0.49],
      [0.47, 0.49, 0.53, 0.49],
      [0.5, 0.49, 0.42, 0.64],
      [0.42, 0.64, 0.42, 0.86],
      [0.5, 0.49, 0.58, 0.64],
      [0.58, 0.64, 0.58, 0.86],
    ],
    finish: [
      [0.5, 0.31, 0.5, 0.57],
      [0.5, 0.43, 0.43, 0.48],
      [0.43, 0.48, 0.48, 0.55],
      [0.5, 0.43, 0.57, 0.48],
      [0.57, 0.48, 0.52, 0.55],
      [0.48, 0.55, 0.52, 0.55],
      [0.5, 0.57, 0.42, 0.66],
      [0.42, 0.66, 0.43, 0.83],
      [0.5, 0.57, 0.59, 0.66],
      [0.59, 0.66, 0.58, 0.83],
    ],
  },
  bench: {
    start: [
      [0.36, 0.52, 0.5, 0.52],
      [0.5, 0.52, 0.54, 0.6],
      [0.54, 0.6, 0.57, 0.39],
      [0.61, 0.52, 0.68, 0.63],
      [0.68, 0.63, 0.75, 0.75],
    ],
    finish: [
      [0.36, 0.52, 0.5, 0.52],
      [0.5, 0.52, 0.53, 0.33],
      [0.53, 0.33, 0.54, 0.16],
      [0.61, 0.52, 0.68, 0.63],
      [0.68, 0.63, 0.75, 0.75],
    ],
  },
  row: {
    start: [
      [0.25, 0.36, 0.31, 0.57],
      [0.31, 0.57, 0.46, 0.61],
      [0.46, 0.61, 0.6, 0.64],
      [0.6, 0.64, 0.69, 0.64],
      [0.31, 0.43, 0.46, 0.43],
    ],
    finish: [
      [0.25, 0.34, 0.3, 0.57],
      [0.3, 0.57, 0.45, 0.61],
      [0.45, 0.61, 0.58, 0.64],
      [0.58, 0.64, 0.67, 0.64],
      [0.3, 0.42, 0.36, 0.45],
    ],
  },
  shoulder: {
    start: [
      [0.47, 0.33, 0.41, 0.39],
      [0.41, 0.39, 0.4, 0.27],
      [0.57, 0.33, 0.63, 0.39],
      [0.63, 0.39, 0.62, 0.27],
      [0.52, 0.33, 0.52, 0.64],
    ],
    finish: [
      [0.47, 0.33, 0.45, 0.2],
      [0.45, 0.2, 0.45, 0.07],
      [0.57, 0.33, 0.58, 0.2],
      [0.58, 0.2, 0.58, 0.07],
      [0.52, 0.33, 0.52, 0.64],
    ],
  },
  hinge: {
    start: [
      [0.55, 0.27, 0.54, 0.52],
      [0.54, 0.52, 0.48, 0.68],
      [0.48, 0.68, 0.48, 0.87],
      [0.54, 0.52, 0.59, 0.68],
      [0.59, 0.68, 0.59, 0.87],
    ],
    finish: [
      [0.61, 0.29, 0.48, 0.43],
      [0.48, 0.43, 0.45, 0.61],
      [0.45, 0.61, 0.48, 0.82],
      [0.45, 0.61, 0.55, 0.67],
      [0.55, 0.67, 0.55, 0.82],
    ],
  },
};

const workoutExercises: WorkoutExercise[] = [
  {
    name: "Goblet Squat",
    target: "Lower body · Compound",
    weight: "16 kg",
    reps: "10",
    tempo: "3–1–1",
    phases: ["LOWER", "HOLD", "DRIVE"],
    formFrames: [
      require("./assets/exercises/goblet-squat/start.jpg"),
      require("./assets/exercises/goblet-squat/finish.jpg"),
    ],
    poseGuide: poseGuides.squat!,
  },
  {
    name: "Dumbbell Press",
    target: "Chest · Compound",
    weight: "12 kg",
    reps: "10",
    tempo: "2–1–1",
    phases: ["LOWER", "PAUSE", "PRESS"],
    formFrames: [
      require("./assets/exercises/dumbbell-bench-press/start.jpg"),
      require("./assets/exercises/dumbbell-bench-press/finish.jpg"),
    ],
    poseGuide: poseGuides.bench!,
  },
  {
    name: "Seated Row",
    target: "Back · Controlled",
    weight: "25 kg",
    reps: "12",
    tempo: "2–1–2",
    phases: ["REACH", "PULL", "RETURN"],
    formFrames: [
      require("./assets/exercises/seated-cable-row/start.jpg"),
      require("./assets/exercises/seated-cable-row/finish.jpg"),
    ],
    poseGuide: poseGuides.row!,
  },
];

function createWorkout(profile: Record<string, string>): WorkoutExercise[] {
  const reducedLoad =
    profile.age === "45-54" ||
    profile.age === "55-plus" ||
    profile.experience === "beginner";
  const reps = reducedLoad ? "8" : profile.goal === "strength" ? "6" : "10";
  const femaleExercises: WorkoutExercise[] = [
    {
      ...workoutExercises[0]!,
      name: "Dumbbell Front Squat",
      video: require("./assets/exercise-videos/female-dumbbell-squat.mp4"),
      formFrames: [
        require("./assets/exercises/female-goblet-squat/start.jpg"),
        require("./assets/exercises/female-goblet-squat/finish.jpg"),
      ],
    },
    {
      ...workoutExercises[2]!,
      name: "Dumbbell Romanian Deadlift",
      target: "Glutes & hamstrings · Controlled",
      video: require("./assets/exercise-videos/female-dumbbell-deadlift.mp4"),
      phases: ["HINGE", "STRETCH", "DRIVE"],
      formFrames: [
        require("./assets/exercises/female-dumbbell-rdl/start.jpg"),
        require("./assets/exercises/female-dumbbell-rdl/finish.jpg"),
      ],
      poseGuide: poseGuides.hinge!,
    },
    {
      ...workoutExercises[1]!,
      name: "Dumbbell Shoulder Press",
      target: "Shoulders · Strength",
      video: require("./assets/exercise-videos/female-shoulder-press.mp4"),
      phases: ["LOWER", "BRACE", "PRESS"],
      formFrames: [
        require("./assets/exercises/female-dumbbell-bench-press/start.jpg"),
        require("./assets/exercises/female-dumbbell-bench-press/finish.jpg"),
      ],
    },
    {
      ...workoutExercises[0]!,
      name: "Dumbbell Reverse Lunge",
      target: "Legs & glutes · Unilateral",
      video: require("./assets/exercise-videos/female-dumbbell-lunge.mp4"),
      phases: ["STEP", "LOWER", "DRIVE"],
      formFrames: [
        require("./assets/exercises/female-reverse-lunge/start.jpg"),
        require("./assets/exercises/female-reverse-lunge/finish.jpg"),
      ],
    },
    {
      ...workoutExercises[2]!,
      name: "Dumbbell Biceps Curl",
      target: "Arms · Controlled",
      video: require("./assets/exercise-videos/female-bicep-curl.mp4"),
      phases: ["LOWER", "CURL", "SQUEEZE"],
      formFrames: [
        require("./assets/exercises/female-one-arm-row/start.jpg"),
        require("./assets/exercises/female-one-arm-row/finish.jpg"),
      ],
    },
  ];
  const maleExercises: WorkoutExercise[] = [
    {
      ...workoutExercises[1]!,
      name: "Dumbbell Shoulder Press",
      target: "Shoulders · Strength",
      video: require("./assets/exercise-videos/male-shoulder-press.mp4"),
      phases: ["LOWER", "BRACE", "PRESS"],
      formFrames: [
        require("./assets/exercises/dumbbell-shoulder-press/start.jpg"),
        require("./assets/exercises/dumbbell-shoulder-press/finish.jpg"),
      ],
      poseGuide: poseGuides.shoulder!,
    },
    {
      ...workoutExercises[2]!,
      video: require("./assets/exercise-videos/male-seated-row.mp4"),
    },
    {
      ...workoutExercises[1]!,
      name: "Dumbbell Bench Press",
      target: "Chest · Strength",
      video: require("./assets/exercise-videos/male-dumbbell-bench-press.mp4"),
    },
    {
      ...workoutExercises[0]!,
      name: "Push-Up",
      target: "Chest & triceps · Bodyweight",
      video: require("./assets/exercise-videos/male-push-up.mp4"),
      phases: ["LOWER", "HOLD", "PRESS"],
    },
    {
      ...workoutExercises[1]!,
      name: "Dumbbell Biceps Curl",
      target: "Arms · Controlled",
      video: require("./assets/exercise-videos/male-bicep-curl.mp4"),
      phases: ["LOWER", "CURL", "SQUEEZE"],
    },
  ];
  const selectedBase =
    profile.sex === "female" ? femaleExercises : profile.sex === "male" ? maleExercises : workoutExercises;
  const exercises = selectedBase.map((exercise) => ({
    ...exercise,
    reps,
    tempo: profile.age === "55-plus" ? "3–1–2" : exercise.tempo,
    weight:
      exercise.name.includes("Squat")
        ? reducedLoad ? "8 kg" : profile.sex === "male" ? "20 kg" : "14 kg"
        : exercise.name === "Dumbbell Press"
          ? reducedLoad ? "6 kg" : profile.sex === "male" ? "16 kg" : "10 kg"
          : reducedLoad ? "15 kg" : profile.sex === "male" ? "30 kg" : "22 kg",
  }));

  if (profile.limitations === "knee") {
    const squatIndex = exercises.findIndex((exercise) => exercise.name.includes("Squat"));
    if (squatIndex >= 0) {
      exercises[squatIndex] = {
        ...exercises[squatIndex]!,
        name: "Box Goblet Squat",
        target: "Lower body · Knee-aware",
      };
    }
  }
  if (profile.limitations === "shoulder") {
    const pressIndex = exercises.findIndex((exercise) => exercise.name.includes("Press"));
    if (pressIndex >= 0) {
      exercises[pressIndex] = {
        ...exercises[pressIndex]!,
        name: "Neutral-Grip Dumbbell Press",
        target: "Upper body · Shoulder-aware",
        phases: ["LOWER", "PAUSE", "PRESS"],
        formFrames: [
          require("./assets/exercises/neutral-grip-dumbbell-press/start.jpg"),
          require("./assets/exercises/neutral-grip-dumbbell-press/finish.jpg"),
        ],
        poseGuide: poseGuides.bench!,
      };
    }
  }

  return exercises;
}

function ExerciseStill({ frame }: { frame: number }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <Image source={frame} style={styles.exerciseFrameBackdrop} resizeMode="cover" />
      <View style={styles.exerciseFrameBackdropShade} />
      <Image source={frame} style={styles.exerciseVideo} resizeMode="contain" />
    </View>
  );
}

function RealExerciseVideo({ source, poster }: { source: number; poster: number }) {
  const player = useVideoPlayer(source, (videoPlayer) => {
    videoPlayer.loop = true;
    videoPlayer.muted = true;
  });

  useEffect(() => {
    player.loop = true;
    player.muted = true;
    player.play();
    const autoplayRetry = setTimeout(() => player.play(), 300);
    return () => clearTimeout(autoplayRetry);
  }, [player]);

  return (
    <>
      <ExerciseStill frame={poster} />
      <VideoView
        player={player}
        style={styles.realExerciseVideo}
        contentFit="cover"
        nativeControls={false}
        allowsFullscreen={false}
        allowsPictureInPicture={false}
        playsInline
        pointerEvents="none"
      />
    </>
  );
}

function PreloadExerciseVideo({ source }: { source: number }) {
  const player = useVideoPlayer(source, (videoPlayer) => {
    videoPlayer.muted = true;
  });

  useEffect(() => {
    player.pause();
  }, [player]);

  return (
    <VideoView
      player={player}
      style={styles.preloadExerciseVideo}
      nativeControls={false}
      allowsFullscreen={false}
      allowsPictureInPicture={false}
      playsInline
      pointerEvents="none"
    />
  );
}

function ExerciseDemo({
  exerciseIndex,
  paused,
  exercises,
}: {
  exerciseIndex: number;
  paused: boolean;
  exercises: WorkoutExercise[];
}) {
  const [phaseIndex, setPhaseIndex] = useState(0);
  const exercise = exercises[exerciseIndex] ?? exercises[0]!;
  const nextExercise = exercises[exerciseIndex + 1];

  useEffect(() => {
    const phaseTimer = setInterval(() => setPhaseIndex((value) => (value + 1) % 3), 1100);
    return () => clearInterval(phaseTimer);
  }, []);

  return (
    <View style={styles.demoStage}>
      {exercise.video ? (
        <RealExerciseVideo
          key={exercise.video}
          source={exercise.video}
          poster={exercise.formFrames[0]}
        />
      ) : (
        <ExerciseStill frame={exercise.formFrames[0]} />
      )}
      {nextExercise?.video ? (
        <PreloadExerciseVideo key={`preload-${nextExercise.video}`} source={nextExercise.video} />
      ) : null}
      <View style={styles.videoShade} />
      <View style={styles.videoSourceBadge}>
        <View style={styles.formDot} />
        <Text style={styles.videoSourceText}>REAL FORM DEMO</Text>
      </View>
      <View style={styles.tempoPanel}>
        <Text style={styles.tempoLabel}>REP TEMPO</Text>
        <Text style={styles.tempoValue}>{exercise.tempo}</Text>
        <Text style={styles.phaseValue}>{paused ? "REST" : exercise.phases[phaseIndex]}</Text>
      </View>
    </View>
  );
}

function ActiveWorkoutScreen({
  adjustment,
  onExit,
  onViewProgress,
  profile,
}: {
  adjustment?: CoachScenario | null;
  onExit: () => void;
  onViewProgress: () => void;
  profile: Record<string, string>;
}) {
  const { width, height } = useWindowDimensions();
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [completedSets, setCompletedSets] = useState<boolean[]>(
    Array(adjustment === "tired" ? 2 : 3).fill(false),
  );
  const [restSeconds, setRestSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [workoutComplete, setWorkoutComplete] = useState(false);
  const [exerciseInfoOpen, setExerciseInfoOpen] = useState(false);
  const baseExercises = createWorkout(profile);
  const personalizedExercises = adjustment === "time" ? baseExercises.slice(0, 3) : baseExercises;
  const targetSetCount = adjustment === "tired" ? 2 : 3;
  const exercise = personalizedExercises[exerciseIndex] ?? personalizedExercises[0]!;
  const exerciseVisualHeight = Math.min(
    380,
    Math.max(210, Math.min(width * 0.78, height * 0.42)),
  );
  const workoutTitle =
    profile.sex === "female"
      ? "WOMEN’S STRENGTH FOUNDATION"
      : profile.sex === "male"
        ? "MEN’S STRENGTH FOUNDATION"
        : "FULL BODY FOUNDATION";

  useEffect(() => {
    const workoutTimer = setInterval(() => setElapsedSeconds((value) => value + 1), 1000);
    return () => clearInterval(workoutTimer);
  }, []);

  useEffect(() => {
    if (restSeconds <= 0) return;
    const timer = setInterval(() => setRestSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [restSeconds]);

  const finishSet = (index: number) => {
    setCompletedSets((current) => current.map((value, setIndex) => (setIndex === index ? !value : value)));
    if (!completedSets[index]) setRestSeconds(adjustment === "tired" ? 90 : 60);
  };

  const nextExercise = () => {
    if (exerciseIndex < personalizedExercises.length - 1) {
      setExerciseIndex((current) => current + 1);
      setCompletedSets(Array(targetSetCount).fill(false));
      setRestSeconds(0);
    }
  };
  const finishWorkout = () => {
    setRestSeconds(0);
    setWorkoutComplete(true);
  };

  const completedCount = completedSets.filter(Boolean).length;
  const workoutProgress = (exerciseIndex + completedCount / targetSetCount) / personalizedExercises.length;
  const elapsedLabel = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, "0")}:${String(
    elapsedSeconds % 60,
  ).padStart(2, "0")}`;
  const plannedMinutes = adjustment === "time" ? 30 : Number(profile.duration ?? 45);
  const remainingSeconds = Math.max(0, plannedMinutes * 60 - elapsedSeconds);
  const remainingLabel = `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, "0")}`;
  const exerciseGuidance = exercise.name.includes("Squat")
    ? {
        setup: "Hold the dumbbell close to your chest. Set your feet just outside hip width.",
        movement: "Sit between your hips, keep your chest tall, then drive through the whole foot.",
        breathing: "Inhale and brace before lowering. Exhale as you stand.",
        avoid: "Do not let the knees collapse inward or the heels lift.",
      }
    : exercise.name.includes("Deadlift")
      ? {
          setup: "Stand tall with the dumbbells close to your thighs and soften your knees.",
          movement: "Push the hips back, keep the weights close, then squeeze the glutes to stand.",
          breathing: "Inhale and brace before the hinge. Exhale near the top.",
          avoid: "Do not round the back or turn the movement into a squat.",
        }
      : exercise.name.includes("Row")
        ? {
            setup: "Set a neutral spine and begin with the shoulders relaxed.",
            movement: "Pull the handle toward the lower ribs and return under control.",
            breathing: "Exhale during the pull. Inhale during the controlled return.",
            avoid: "Do not shrug, lean back, or use momentum.",
          }
        : exercise.name.includes("Curl")
          ? {
              setup: "Stand tall with the elbows close to your sides and wrists neutral.",
              movement: "Curl without moving the upper arms, squeeze briefly, then lower slowly.",
              breathing: "Exhale while curling. Inhale while lowering.",
              avoid: "Do not swing the torso or let the elbows travel forward.",
            }
          : exercise.name.includes("Lunge")
            ? {
                setup: "Stand tall, brace your trunk, and keep the dumbbells stable by your sides.",
                movement: "Step back, lower both knees with control, then drive through the front foot.",
                breathing: "Inhale while lowering. Exhale as you return to standing.",
                avoid: "Do not let the front knee collapse inward or lose balance.",
              }
            : exercise.name.includes("Push-Up")
              ? {
                  setup: "Place the hands slightly wider than the shoulders and form one straight body line.",
                  movement: "Lower the chest between the hands and press the floor away.",
                  breathing: "Inhale while lowering. Exhale while pressing.",
                  avoid: "Do not drop the hips, flare the elbows, or shorten the range.",
                }
              : {
                  setup: "Set your feet firmly, brace your trunk, and keep the wrists stacked.",
                  movement: "Lower the dumbbells with control and press smoothly without bouncing.",
                  breathing: "Inhale while lowering. Exhale through the press.",
                  avoid: "Do not overarch the back or let the elbows move out of control.",
                };

  if (workoutComplete) {
    return (
      <SafeAreaView style={styles.workoutCompleteScreen}>
        <View style={styles.completeGlow} />
        <ScrollView
          style={styles.workoutCompleteScroll}
          contentContainerStyle={styles.workoutCompleteContent}
          showsVerticalScrollIndicator={false}
        >
        <View style={styles.completeMark}>
          <Text style={styles.completeMarkText}>✓</Text>
        </View>
        <Text style={styles.completeEyebrow}>WORKOUT COMPLETE</Text>
        <Text style={styles.workoutCompleteTitle}>Strong work.</Text>
        <Text style={styles.completeSubtitle}>
          Your session is saved. Your next plan will build from today’s performance.
        </Text>

        <View style={styles.completeStats}>
          <View style={styles.completeStat}>
            <Text style={styles.completeStatValue}>{personalizedExercises.length}</Text>
            <Text style={styles.completeStatLabel}>EXERCISES</Text>
          </View>
          <View style={styles.completeStatDivider} />
          <View style={styles.completeStat}>
            <Text style={styles.completeStatValue}>{personalizedExercises.length * 3}</Text>
            <Text style={styles.completeStatLabel}>SETS</Text>
          </View>
          <View style={styles.completeStatDivider} />
          <View style={styles.completeStat}>
            <Text style={styles.completeStatValue}>{elapsedLabel}</Text>
            <Text style={styles.completeStatLabel}>TIME</Text>
          </View>
        </View>

        <View style={styles.completeAnalysis}>
          <Text style={styles.completeAnalysisTitle}>SESSION ANALYSIS</Text>
          <View style={styles.completeAnalysisRow}>
            <Text style={styles.completeAnalysisLabel}>Technique control</Text>
            <Text style={styles.completeAnalysisValue}>88 / 100</Text>
          </View>
          <View style={styles.completeAnalysisRow}>
            <Text style={styles.completeAnalysisLabel}>Planned volume</Text>
            <Text style={styles.completeAnalysisPositive}>100% COMPLETE</Text>
          </View>
          <View style={styles.completeAnalysisRow}>
            <Text style={styles.completeAnalysisLabel}>Tempo focus</Text>
            <Text style={styles.completeAnalysisValue}>{personalizedExercises[0]?.tempo}</Text>
          </View>
          <View style={[styles.completeAnalysisRow, styles.completeAnalysisLastRow]}>
            <Text style={styles.completeAnalysisLabel}>Next priority</Text>
            <Text style={styles.completeAnalysisValue}>
              {profile.goal === "strength" ? "Progressive load" : profile.goal === "fat-loss" ? "Training density" : "Movement quality"}
            </Text>
          </View>
        </View>

        <View style={styles.completeCoachNote}>
          <Text style={styles.completeCoachLabel}>AI + HUMAN COACH</Text>
          <Text style={styles.completeCoachText}>
            Nice consistency. We’ll use this session to refine your next workout.
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="View progress"
          onPress={onViewProgress}
          style={styles.completeButton}
        >
          <Text style={styles.completeButtonText}>VIEW MY PROGRESS</Text>
          <Text style={styles.completeButtonArrow}>→</Text>
        </Pressable>
        </ScrollView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.activeWorkout}>
      <View style={styles.activeHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="Exit workout" onPress={onExit} style={styles.workoutClose}>
          <Text style={styles.workoutCloseText}>×</Text>
        </Pressable>
        <View style={styles.activeHeaderCenter}>
          <Text style={styles.activeHeaderLabel}>{workoutTitle}</Text>
          <View style={styles.activeProgressTrack}>
            <View style={[styles.activeProgressFill, { width: `${workoutProgress * 100}%` }]} />
          </View>
        </View>
        <View style={styles.workoutElapsed}><Text style={styles.workoutElapsedText}>{elapsedLabel}</Text></View>
      </View>

      <ScrollView
        style={styles.activeWorkoutScroll}
        contentContainerStyle={styles.activeWorkoutScrollContent}
        showsVerticalScrollIndicator={false}
      >
      <View style={[styles.exerciseVisual, { height: exerciseVisualHeight }]}>
        <View style={styles.exerciseGlow} />
        <Text style={styles.exerciseNumber}>0{exerciseIndex + 1}</Text>
        <ExerciseDemo
          key={exerciseIndex}
          exerciseIndex={exerciseIndex}
          paused={restSeconds > 0}
          exercises={personalizedExercises}
        />
        <View style={styles.formBadge}>
          <View style={styles.formDot} />
          <Text style={styles.formBadgeText}>{remainingLabel} REMAINING</Text>
        </View>
      </View>

      <View style={styles.exerciseSheet}>
        <View style={styles.exerciseHeadingRow}>
          <View>
            <Text style={styles.exerciseStep}>EXERCISE {exerciseIndex + 1} OF {personalizedExercises.length}</Text>
            <Text style={styles.exerciseName}>{exercise.name}</Text>
            <Text style={styles.exerciseTarget}>{exercise.target}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Exercise guidance for ${exercise.name}`}
            onPress={() => setExerciseInfoOpen(true)}
            style={styles.exerciseInfo}
          >
            <Text style={styles.exerciseInfoText}>i</Text>
          </Pressable>
        </View>

        {restSeconds > 0 ? (
          <View style={styles.restBanner}>
            <View>
              <Text style={styles.restLabel}>REST TIMER</Text>
              <Text style={styles.restHint}>Breathe. Your next set is ready.</Text>
            </View>
            <Text style={styles.restValue}>0:{String(restSeconds).padStart(2, "0")}</Text>
          </View>
        ) : null}

        <View style={styles.setTableHeader}>
          <Text style={[styles.setHeaderText, styles.setColumn]}>SET</Text>
          <Text style={[styles.setHeaderText, styles.weightColumn]}>WEIGHT</Text>
          <Text style={[styles.setHeaderText, styles.repsColumn]}>REPS</Text>
          <View style={styles.doneColumn} />
        </View>

        <View style={styles.setList}>
          {completedSets.map((done, index) => (
            <View key={index} style={[styles.setRow, done && styles.setRowDone]}>
              <Text style={[styles.setIndex, done && styles.setTextDone]}>{index + 1}</Text>
              <View style={styles.weightColumn}>
                <Text style={[styles.setValue, done && styles.setTextDone]}>{exercise.weight}</Text>
              </View>
              <View style={styles.repsColumn}>
                <Text style={[styles.setValue, done && styles.setTextDone]}>{exercise.reps}</Text>
              </View>
              <Pressable
                accessibilityRole="checkbox"
                accessibilityState={{ checked: done }}
                onPress={() => finishSet(index)}
                style={[styles.setCheck, done && styles.setCheckDone]}
              >
                <Text style={[styles.setCheckText, done && styles.setCheckTextDone]}>{done ? "✓" : ""}</Text>
              </Pressable>
            </View>
          ))}
        </View>

        <View style={styles.coachCue}>
          <View style={styles.coachCueIcon}><Text style={styles.coachCueIconText}>G</Text></View>
          <View style={styles.coachCueCopy}>
            <Text style={styles.coachCueLabel}>COACH CUE</Text>
            <Text style={styles.coachCueText}>Keep your chest tall and control the lowering phase.</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            exerciseIndex === personalizedExercises.length - 1
              ? "Finish workout"
              : "Next exercise"
          }
          disabled={completedCount < 3}
          onPress={
            exerciseIndex === personalizedExercises.length - 1
              ? finishWorkout
              : nextExercise
          }
          style={[styles.nextExerciseButton, completedCount < 3 && styles.nextExerciseDisabled]}
        >
          <Text style={[styles.nextExerciseText, completedCount < 3 && styles.nextExerciseTextDisabled]}>
            {exerciseIndex === personalizedExercises.length - 1 ? "FINISH WORKOUT" : "NEXT EXERCISE"}
          </Text>
          <Text style={[styles.nextExerciseArrow, completedCount < 3 && styles.nextExerciseTextDisabled]}>→</Text>
        </Pressable>
      </View>
      </ScrollView>

      <Modal
        transparent
        animationType="slide"
        visible={exerciseInfoOpen}
        statusBarTranslucent
        onRequestClose={() => setExerciseInfoOpen(false)}
      >
        <Pressable style={styles.exerciseInfoBackdrop} onPress={() => setExerciseInfoOpen(false)}>
          <Pressable style={styles.exerciseInfoPanel} onPress={(event) => event.stopPropagation()}>
            <View style={styles.exerciseInfoHandle} />
            <View style={styles.exerciseInfoPanelHeader}>
              <View style={styles.exerciseInfoPanelTitleWrap}>
                <Text style={styles.exerciseInfoPanelEyebrow}>FORM GUIDE</Text>
                <Text style={styles.exerciseInfoPanelTitle}>{exercise.name}</Text>
                <Text style={styles.exerciseInfoPanelTempo}>Tempo {exercise.tempo}</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close exercise guidance"
                onPress={() => setExerciseInfoOpen(false)}
                style={styles.exerciseInfoClose}
              >
                <Text style={styles.exerciseInfoCloseText}>×</Text>
              </Pressable>
            </View>

            {[
              ["SETUP", exerciseGuidance.setup],
              ["MOVEMENT", exerciseGuidance.movement],
              ["BREATHING", exerciseGuidance.breathing],
              ["AVOID", exerciseGuidance.avoid],
            ].map(([label, copy]) => (
              <View key={label} style={styles.exerciseInfoGuideRow}>
                <View style={styles.exerciseInfoGuideDot} />
                <View style={styles.exerciseInfoGuideCopy}>
                  <Text style={styles.exerciseInfoGuideLabel}>{label}</Text>
                  <Text style={styles.exerciseInfoGuideText}>{copy}</Text>
                </View>
              </View>
            ))}

            <Pressable onPress={() => setExerciseInfoOpen(false)} style={styles.exerciseInfoDone}>
              <Text style={styles.exerciseInfoDoneText}>GOT IT</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function ProgressScreen({
  onDashboard,
  profile,
}: {
  onDashboard: () => void;
  profile: Record<string, string>;
}) {
  const nextFocus =
    profile.goal === "strength"
      ? "Progressive load"
      : profile.goal === "fat-loss"
        ? "Training density"
        : "Movement quality";

  return (
    <SafeAreaView style={styles.progressScreen}>
      <ScrollView contentContainerStyle={styles.progressContent} showsVerticalScrollIndicator={false}>
        <View style={styles.progressHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to dashboard"
            onPress={onDashboard}
            style={styles.progressBack}
          >
            <Text style={styles.progressBackText}>‹</Text>
          </Pressable>
          <Text style={styles.progressHeaderTitle}>PROGRESS</Text>
          <View style={styles.progressHeaderSpacer} />
        </View>

        <Text style={styles.progressEyebrow}>FOUNDATION WEEK · SESSION 01</Text>
        <Text style={styles.progressTitle}>Your baseline is set.</Text>
        <Text style={styles.progressSubtitle}>
          Project G will use today’s performance to personalize what comes next.
        </Text>

        <View style={styles.progressHero}>
          <View>
            <Text style={styles.progressScoreValue}>100%</Text>
            <Text style={styles.progressScoreLabel}>SESSION COMPLETE</Text>
          </View>
          <View style={styles.progressHeroBadge}>
            <Text style={styles.progressHeroBadgeValue}>88</Text>
            <Text style={styles.progressHeroBadgeLabel}>FORM SCORE</Text>
          </View>
        </View>

        <View style={styles.progressMetrics}>
          <View style={styles.progressMetric}>
            <Text style={styles.progressMetricValue}>5</Text>
            <Text style={styles.progressMetricLabel}>EXERCISES</Text>
          </View>
          <View style={styles.progressMetricDivider} />
          <View style={styles.progressMetric}>
            <Text style={styles.progressMetricValue}>15</Text>
            <Text style={styles.progressMetricLabel}>SETS</Text>
          </View>
          <View style={styles.progressMetricDivider} />
          <View style={styles.progressMetric}>
            <Text style={styles.progressMetricValue}>1</Text>
            <Text style={styles.progressMetricLabel}>WORKOUT</Text>
          </View>
        </View>

        <View style={styles.progressSection}>
          <Text style={styles.progressSectionTitle}>TODAY’S ANALYSIS</Text>
          <View style={styles.progressRowTop}>
            <Text style={styles.progressRowLabel}>Movement control</Text>
            <Text style={styles.progressRowValue}>88 / 100</Text>
          </View>
          <View style={styles.analysisProgressTrack}>
            <View style={[styles.analysisProgressFill, { width: "88%" }]} />
          </View>
          <View style={styles.progressRowTop}>
            <Text style={styles.progressRowLabel}>Planned volume</Text>
            <Text style={styles.progressRowPositive}>100%</Text>
          </View>
          <View style={styles.analysisProgressTrack}>
            <View style={[styles.analysisProgressFill, { width: "100%" }]} />
          </View>
          <View style={styles.progressPriority}>
            <Text style={styles.progressPriorityLabel}>NEXT TRAINING FOCUS</Text>
            <Text style={styles.progressPriorityValue}>{nextFocus}</Text>
          </View>
        </View>

        <View style={styles.progressCoachCard}>
          <View style={styles.progressCoachMark}><Text style={styles.progressCoachMarkText}>G</Text></View>
          <View style={styles.progressCoachCopy}>
            <Text style={styles.progressCoachLabel}>AI + HUMAN COACH INSIGHT</Text>
            <Text style={styles.progressCoachText}>
              Baseline established. Your next session will adjust load, exercise selection, and tempo from today’s result.
            </Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back to dashboard"
          onPress={onDashboard}
          style={styles.progressButton}
        >
          <Text style={styles.progressButtonText}>BACK TO DASHBOARD</Text>
          <Text style={styles.progressButtonArrow}>→</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [profile, setProfile] = useState<Record<string, string>>({});
  const [coachAdjustment, setCoachAdjustment] = useState<CoachScenario | null>(null);

  return (
    <View style={styles.app}>
      {Platform.OS === "android" ? <StatusBar backgroundColor={colors.background} /> : null}
      <ExpoStatusBar style="light" />
      <View style={styles.mobileViewport}>
        {screen === "splash" && <SplashScreen onComplete={() => setScreen("welcome")} />}
        {screen === "welcome" && <WelcomeScreen onStart={() => setScreen("interview")} />}
        {screen === "interview" && (
          <InterviewScreen
            onBack={() => setScreen("welcome")}
            onFinish={(answers) => {
              setProfile(answers);
              setScreen("dashboard");
            }}
            onStartWorkout={(answers) => {
              setProfile(answers);
              setScreen("workout");
            }}
          />
        )}
        {screen === "dashboard" && (
          <DashboardScreen
            profile={profile}
            onStartWorkout={() => setScreen("workout")}
            onOpenCoach={() => setScreen("coach")}
          />
        )}
        {screen === "coach" && (
          <AICoachScreen
            profile={profile}
            onBack={() => setScreen("dashboard")}
            onApply={setCoachAdjustment}
            onStartWorkout={() => setScreen("workout")}
          />
        )}
        {screen === "workout" && (
          <ActiveWorkoutScreen
            adjustment={coachAdjustment}
            profile={profile}
            onExit={() => setScreen("dashboard")}
            onViewProgress={() => setScreen("progress")}
          />
        )}
        {screen === "progress" && (
          <ProgressScreen profile={profile} onDashboard={() => setScreen("dashboard")} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#020302",
  },
  mobileViewport: {
    flex: 1,
    width: "100%",
    maxWidth: 440,
    overflow: "hidden",
    backgroundColor: colors.background,
    borderLeftWidth: Platform.OS === "web" ? 1 : 0,
    borderRightWidth: Platform.OS === "web" ? 1 : 0,
    borderColor: "#20241F",
  },
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
  welcomeHeroLayer: { ...StyleSheet.absoluteFillObject },
  welcomeHeroImage: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
  },
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
    height: "32%",
    backgroundColor: "rgba(0,0,0,0.76)",
  },
  welcomeSafe: { flex: 1 },
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
  welcomeScroll: { flex: 1 },
  welcomeScrollContent: { paddingTop: 500 },
  welcomeContent: {
    paddingHorizontal: 24,
    paddingTop: 18,
    paddingBottom: 24,
    backgroundColor: "rgba(0,0,0,0.86)",
  },
  eyebrow: {
    color: colors.lime,
    fontSize: 21,
    lineHeight: 24,
    fontWeight: "900",
    letterSpacing: 1.25,
    marginBottom: 16,
    textShadowColor: "rgba(190,255,40,0.24)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
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
  dashboard: { flex: 1, backgroundColor: colors.background },
  dashboardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingTop: Platform.OS === "android" ? 16 : 6,
    paddingBottom: 13,
  },
  dashboardGreeting: { color: colors.muted, fontSize: 8, fontWeight: "800", letterSpacing: 1.6 },
  dashboardName: { color: colors.text, fontSize: 22, fontWeight: "700", letterSpacing: -0.7, marginTop: 4 },
  dashboardAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#353A31",
    backgroundColor: "#131612",
  },
  dashboardAvatarText: { color: colors.text, fontSize: 16, fontWeight: "800" },
  avatarStatus: {
    position: "absolute",
    right: 1,
    bottom: 2,
    width: 9,
    height: 9,
    borderRadius: 5,
    borderWidth: 2,
    borderColor: colors.background,
    backgroundColor: colors.lime,
  },
  dashboardBody: { flex: 1, paddingHorizontal: 18 },
  readinessRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  readinessCard: {
    minHeight: 78,
    borderRadius: 18,
    paddingHorizontal: 13,
    marginBottom: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#293128",
    backgroundColor: "#0E120F",
  },
  readinessCopy: { flex: 1, marginLeft: 13 },
  readinessHint: { color: colors.muted, fontSize: 8, marginTop: 4 },
  cardChevron: { color: colors.muted, fontSize: 22 },
  quickTitle: {
    color: colors.muted,
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 1.4,
    marginBottom: 8,
  },
  sectionEyebrow: { color: colors.lime, fontSize: 8, fontWeight: "800", letterSpacing: 1.5 },
  readinessTitle: { color: colors.text, fontSize: 17, fontWeight: "700", marginTop: 5 },
  recoveryScore: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: colors.lime,
    backgroundColor: "#10130E",
  },
  recoveryValue: { color: colors.text, fontSize: 19, fontWeight: "800", lineHeight: 21 },
  recoveryLabel: { color: colors.muted, fontSize: 5, fontWeight: "800", letterSpacing: 0.7 },
  workoutCard: {
    borderRadius: 24,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#2B3126",
    backgroundColor: "#121610",
  },
  workoutCardTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  workoutTypeBadge: { borderRadius: 10, paddingVertical: 5, paddingHorizontal: 8, backgroundColor: colors.lime },
  workoutTypeText: { color: colors.ink, fontSize: 7, fontWeight: "900", letterSpacing: 1 },
  workoutDuration: { color: colors.muted, fontSize: 8, fontWeight: "800", letterSpacing: 1.2 },
  workoutTitle: {
    color: colors.text,
    fontSize: 31,
    lineHeight: 32,
    fontWeight: "700",
    letterSpacing: -1.3,
    marginTop: 15,
  },
  workoutMeta: { color: colors.muted, fontSize: 11, marginTop: 8 },
  workoutCoachNote: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 15,
    paddingTop: 13,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#343A30",
  },
  coachMiniAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.lime,
    marginRight: 9,
  },
  coachMiniText: { color: colors.text, fontSize: 9, fontWeight: "800" },
  workoutCoachText: { color: "#C6CBC2", fontSize: 10, flex: 1 },
  workoutButton: {
    height: 50,
    borderRadius: 25,
    paddingHorizontal: 18,
    marginTop: 15,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.lime,
  },
  workoutButtonText: { color: colors.ink, fontSize: 11, fontWeight: "900", letterSpacing: 1.1 },
  workoutButtonArrow: { color: colors.ink, fontSize: 19, fontWeight: "700" },
  metricGrid: { flexDirection: "row", gap: 8, marginBottom: 10 },
  metricCard: {
    flex: 1,
    minHeight: 68,
    borderRadius: 15,
    padding: 12,
    borderWidth: 1,
    borderColor: "#242824",
    backgroundColor: "#0D0F0D",
  },
  metricIcon: { color: colors.lime, fontSize: 13, marginBottom: 8 },
  metricValue: { color: colors.text, fontSize: 18, fontWeight: "800" },
  metricLabel: { color: colors.muted, fontSize: 7, fontWeight: "800", letterSpacing: 1.2, marginTop: 2 },
  metricTrend: { color: "#6F756C", fontSize: 8, marginTop: 7 },
  lastWorkoutCard: {
    minHeight: 58,
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "#242824",
    backgroundColor: "#0D0F0D",
  },
  lastWorkoutScore: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#37C85A",
  },
  lastWorkoutScoreText: { color: "#37C85A", fontSize: 10, fontWeight: "900" },
  weekCard: {
    minHeight: 58,
    borderRadius: 17,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#242824",
    backgroundColor: "#0D0F0D",
  },
  weekLabel: { color: colors.muted, fontSize: 7, fontWeight: "800", letterSpacing: 1.1 },
  weekValue: { color: colors.text, fontSize: 11, fontWeight: "700", marginTop: 3 },
  weekProgressTrack: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#292D27",
    marginHorizontal: 13,
    overflow: "hidden",
  },
  weekProgressFill: { width: "33%", height: "100%", backgroundColor: colors.lime },
  weekPercent: { color: colors.lime, fontSize: 10, fontWeight: "800" },
  bottomNav: {
    height: 70,
    paddingHorizontal: 12,
    paddingTop: 9,
    flexDirection: "row",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#242724",
    backgroundColor: "#090A09",
  },
  navItem: { flex: 1, alignItems: "center" },
  navIcon: { color: "#666C63", fontSize: 18, lineHeight: 22 },
  navLabel: { color: "#666C63", fontSize: 6, fontWeight: "800", letterSpacing: 0.8, marginTop: 3 },
  navActive: { color: colors.lime },
  workoutCompleteScreen: {
    flex: 1,
    overflow: "hidden",
    backgroundColor: colors.background,
  },
  workoutCompleteScroll: {
    flex: 1,
    width: "100%",
  },
  workoutCompleteContent: {
    width: "100%",
    maxWidth: 520,
    minHeight: "100%",
    alignSelf: "center",
    paddingHorizontal: 22,
    paddingTop: 34,
    paddingBottom: 34,
    alignItems: "center",
    justifyContent: "center",
  },
  completeGlow: {
    position: "absolute",
    top: -130,
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: "rgba(200,255,50,0.08)",
  },
  completeMark: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lime,
    marginBottom: 24,
  },
  completeMarkText: { color: colors.ink, fontSize: 38, lineHeight: 44, fontWeight: "900" },
  completeEyebrow: { color: colors.lime, fontSize: 10, fontWeight: "900", letterSpacing: 1.8 },
  workoutCompleteTitle: {
    color: colors.text,
    fontSize: 42,
    lineHeight: 48,
    fontWeight: "900",
    letterSpacing: -1.6,
    marginTop: 10,
  },
  completeSubtitle: {
    maxWidth: 350,
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginTop: 12,
  },
  completeStats: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    borderWidth: 1,
    borderColor: "rgba(200,255,50,0.28)",
    borderRadius: 22,
    backgroundColor: "#0E110D",
    paddingVertical: 22,
    marginTop: 30,
  },
  completeStat: { flex: 1, alignItems: "center" },
  completeStatValue: { color: colors.text, fontSize: 21, fontWeight: "900" },
  completeStatLabel: { color: colors.muted, fontSize: 7, fontWeight: "900", letterSpacing: 1.1, marginTop: 5 },
  completeStatDivider: { width: 1, height: 34, backgroundColor: "rgba(255,255,255,0.12)" },
  completeAnalysis: {
    width: "100%",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "#0D0F0D",
    paddingHorizontal: 16,
    paddingTop: 15,
    marginTop: 14,
  },
  completeAnalysisTitle: {
    color: colors.lime,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.3,
    marginBottom: 7,
  },
  completeAnalysisRow: {
    minHeight: 34,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.07)",
  },
  completeAnalysisLastRow: { borderBottomWidth: 0 },
  completeAnalysisLabel: { color: colors.muted, fontSize: 10 },
  completeAnalysisValue: { color: colors.text, fontSize: 10, fontWeight: "800" },
  completeAnalysisPositive: { color: colors.lime, fontSize: 9, fontWeight: "900", letterSpacing: 0.6 },
  completeCoachNote: {
    width: "100%",
    borderRadius: 18,
    backgroundColor: colors.surface,
    padding: 18,
    marginTop: 14,
  },
  completeCoachLabel: { color: colors.lime, fontSize: 8, fontWeight: "900", letterSpacing: 1.2 },
  completeCoachText: { color: colors.text, fontSize: 12, lineHeight: 18, marginTop: 7 },
  completeButton: {
    width: "100%",
    minHeight: 62,
    borderRadius: 31,
    backgroundColor: colors.lime,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    marginTop: 18,
  },
  completeButtonText: { color: colors.ink, fontSize: 11, fontWeight: "900", letterSpacing: 1.4 },
  completeButtonArrow: { color: colors.ink, fontSize: 22, fontWeight: "800" },
  activeWorkout: { flex: 1, backgroundColor: colors.background },
  activeWorkoutScroll: { flex: 1 },
  activeWorkoutScrollContent: { flexGrow: 1, paddingBottom: 18 },
  activeHeader: {
    height: 58,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
  },
  workoutClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#30342F",
  },
  workoutCloseText: { color: colors.text, fontSize: 25, lineHeight: 27, fontWeight: "300" },
  activeHeaderCenter: { flex: 1, marginHorizontal: 13 },
  activeHeaderLabel: { color: colors.muted, fontSize: 7, fontWeight: "800", letterSpacing: 1.2, textAlign: "center" },
  activeProgressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: "#272B26",
    marginTop: 7,
    overflow: "hidden",
  },
  activeProgressFill: { height: "100%", borderRadius: 2, backgroundColor: colors.lime },
  workoutElapsed: {
    minWidth: 48,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#151815",
  },
  workoutElapsedText: { color: colors.text, fontSize: 9, fontWeight: "700" },
  exerciseVisual: {
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    backgroundColor: "#0B0D0B",
  },
  exerciseGlow: {
    position: "absolute",
    width: 210,
    height: 210,
    borderRadius: 105,
    backgroundColor: "rgba(200,255,50,0.055)",
  },
  exerciseNumber: {
    position: "absolute",
    left: 18,
    top: 11,
    color: "#191D18",
    fontSize: 72,
    lineHeight: 78,
    fontWeight: "900",
  },
  motionFigure: {
    width: 82,
    height: 82,
    borderRadius: 41,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(200,255,50,0.55)",
    backgroundColor: "#11150F",
  },
  motionFigureText: { color: colors.text, fontSize: 31, fontWeight: "800" },
  demoStage: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  realExerciseVideo: {
    ...StyleSheet.absoluteFillObject,
    width: "100%",
    height: "100%",
    backgroundColor: "transparent",
  },
  preloadExerciseVideo: {
    position: "absolute",
    width: 1,
    height: 1,
    opacity: 0,
    right: 0,
    bottom: 0,
  },
  exerciseVideo: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
  },
  exerciseFrameBackdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    opacity: 0.4,
    transform: [{ scale: 1.08 }],
  },
  exerciseFrameBackdropShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.42)",
  },
  poseFrameHost: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
  },
  poseFrame: {
    height: "100%",
    aspectRatio: 850 / 567,
    maxWidth: "100%",
  },
  poseCanvas: { width: "100%", height: "100%" },
  poseLine: {
    position: "absolute",
    height: 3,
    marginTop: -1.5,
    borderRadius: 2,
    backgroundColor: "#63FF77",
    shadowColor: "#63FF77",
    shadowOpacity: 0.9,
    shadowRadius: 4,
  },
  poseJoint: {
    position: "absolute",
    width: 9,
    height: 9,
    marginLeft: -4.5,
    marginTop: -4.5,
    borderRadius: 4.5,
    borderWidth: 2,
    borderColor: "#63FF77",
    backgroundColor: "#FF8A2B",
  },
  videoShade: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  videoSourceBadge: {
    position: "absolute",
    left: 14,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  videoSourceText: { color: colors.text, fontSize: 6, fontWeight: "900", letterSpacing: 0.8 },
  demoFloor: {
    position: "absolute",
    left: 27,
    right: 27,
    bottom: 15,
    height: 1,
    backgroundColor: "rgba(200,255,50,0.2)",
  },
  demoPerson: { width: 78, height: 112, alignItems: "center", marginTop: -8 },
  demoHead: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.lime,
    backgroundColor: "#171B15",
  },
  demoTorso: {
    width: 36,
    height: 44,
    borderRadius: 12,
    marginTop: 3,
    alignItems: "center",
    backgroundColor: "#30372B",
  },
  demoCore: { width: 4, height: 29, borderRadius: 2, marginTop: 7, backgroundColor: colors.lime },
  demoArm: {
    position: "absolute",
    top: 4,
    width: 10,
    height: 39,
    borderRadius: 5,
    backgroundColor: "#687060",
  },
  demoArmLeft: { left: -9, transform: [{ rotate: "17deg" }] },
  demoArmRight: { right: -9, transform: [{ rotate: "-17deg" }] },
  demoLegs: { flexDirection: "row", width: 46, height: 42, justifyContent: "space-between" },
  demoLeg: { width: 11, height: 42, borderRadius: 6, backgroundColor: "#4B5247" },
  demoLegLeft: { transform: [{ rotate: "7deg" }] },
  demoLegRight: { transform: [{ rotate: "-7deg" }] },
  demoWeight: {
    position: "absolute",
    top: 35,
    width: 25,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lime,
  },
  demoWeightText: { color: colors.ink, fontSize: 9 },
  tempoPanel: {
    position: "absolute",
    right: 14,
    top: 14,
    alignItems: "flex-end",
    paddingVertical: 7,
    paddingHorizontal: 9,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.72)",
  },
  tempoLabel: { color: "#666D63", fontSize: 6, fontWeight: "800", letterSpacing: 1 },
  tempoValue: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 2 },
  phaseValue: { color: colors.lime, fontSize: 7, fontWeight: "900", letterSpacing: 1, marginTop: 3 },
  formBadge: {
    position: "absolute",
    right: 15,
    bottom: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    paddingHorizontal: 9,
    borderRadius: 12,
    backgroundColor: "rgba(10,12,10,0.78)",
  },
  formDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.lime, marginRight: 6 },
  formBadgeText: { color: colors.text, fontSize: 6, fontWeight: "800", letterSpacing: 0.8 },
  exerciseSheet: {
    flexGrow: 1,
    paddingHorizontal: 18,
    paddingTop: 15,
    paddingBottom: 18,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    backgroundColor: "#090A09",
  },
  exerciseHeadingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  exerciseStep: { color: colors.lime, fontSize: 7, fontWeight: "800", letterSpacing: 1.2 },
  exerciseName: { color: colors.text, fontSize: 25, lineHeight: 28, fontWeight: "700", marginTop: 4, letterSpacing: -0.9 },
  exerciseTarget: { color: colors.muted, fontSize: 9, marginTop: 4 },
  exerciseInfo: {
    width: 31,
    height: 31,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#353A34",
  },
  exerciseInfoText: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  exerciseInfoBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  exerciseInfoPanel: {
    width: "100%",
    maxWidth: 520,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: "#2A3028",
    backgroundColor: "#0D100D",
  },
  exerciseInfoHandle: {
    width: 42,
    height: 4,
    borderRadius: 2,
    alignSelf: "center",
    marginBottom: 18,
    backgroundColor: "#343A32",
  },
  exerciseInfoPanelHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 18,
  },
  exerciseInfoPanelTitleWrap: { flex: 1, paddingRight: 16 },
  exerciseInfoPanelEyebrow: { color: colors.lime, fontSize: 9, fontWeight: "900", letterSpacing: 1.6 },
  exerciseInfoPanelTitle: { color: colors.text, fontSize: 27, lineHeight: 31, fontWeight: "800", marginTop: 5 },
  exerciseInfoPanelTempo: { color: colors.muted, fontSize: 11, marginTop: 5 },
  exerciseInfoClose: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#353A34",
    alignItems: "center",
    justifyContent: "center",
  },
  exerciseInfoCloseText: { color: colors.text, fontSize: 23, lineHeight: 25, fontWeight: "300" },
  exerciseInfoGuideRow: {
    flexDirection: "row",
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: "#20251F",
  },
  exerciseInfoGuideDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    marginTop: 5,
    marginRight: 12,
    backgroundColor: colors.lime,
  },
  exerciseInfoGuideCopy: { flex: 1 },
  exerciseInfoGuideLabel: { color: colors.lime, fontSize: 8, fontWeight: "900", letterSpacing: 1.25 },
  exerciseInfoGuideText: { color: "#D4D8D1", fontSize: 13, lineHeight: 19, marginTop: 4 },
  exerciseInfoDone: {
    minHeight: 52,
    borderRadius: 26,
    marginTop: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lime,
  },
  exerciseInfoDoneText: { color: colors.ink, fontSize: 12, fontWeight: "900", letterSpacing: 1.7 },
  restBanner: {
    minHeight: 52,
    borderRadius: 15,
    marginTop: 12,
    paddingHorizontal: 13,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(200,255,50,0.24)",
    backgroundColor: "rgba(200,255,50,0.065)",
  },
  restLabel: { color: colors.lime, fontSize: 7, fontWeight: "900", letterSpacing: 1.1 },
  restHint: { color: colors.muted, fontSize: 8, marginTop: 3 },
  restValue: { color: colors.text, fontSize: 23, fontWeight: "800" },
  setTableHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 11, marginTop: 14, marginBottom: 5 },
  setHeaderText: { color: "#666C64", fontSize: 7, fontWeight: "800", letterSpacing: 1 },
  setColumn: { width: 42 },
  weightColumn: { flex: 1 },
  repsColumn: { width: 68 },
  doneColumn: { width: 36 },
  setList: { gap: 7 },
  setRow: {
    height: 47,
    borderRadius: 14,
    paddingHorizontal: 11,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#242824",
    backgroundColor: "#0E100E",
  },
  setRowDone: { borderColor: "rgba(200,255,50,0.2)", backgroundColor: "rgba(200,255,50,0.055)" },
  setIndex: { width: 42, color: colors.muted, fontSize: 12, fontWeight: "700" },
  setValue: { color: colors.text, fontSize: 13, fontWeight: "700" },
  setTextDone: { color: "#858B82" },
  setCheck: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#3A3F38",
  },
  setCheckDone: { borderColor: colors.lime, backgroundColor: colors.lime },
  setCheckText: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  setCheckTextDone: { color: colors.ink },
  coachCue: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 11,
    padding: 11,
    borderRadius: 14,
    backgroundColor: "#111310",
  },
  coachCueIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.lime,
    marginRight: 10,
  },
  coachCueIconText: { color: colors.text, fontSize: 10, fontWeight: "800" },
  coachCueCopy: { flex: 1 },
  coachCueLabel: { color: colors.lime, fontSize: 6, fontWeight: "900", letterSpacing: 1 },
  coachCueText: { color: "#BAC0B7", fontSize: 9, lineHeight: 13, marginTop: 3 },
  nextExerciseButton: {
    height: 51,
    borderRadius: 26,
    marginTop: 11,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.lime,
  },
  nextExerciseDisabled: { backgroundColor: "#171A17" },
  nextExerciseText: { color: colors.ink, fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  nextExerciseArrow: { color: colors.ink, fontSize: 19, fontWeight: "700" },
  nextExerciseTextDisabled: { color: "#50554F" },
  coachScreen: { flex: 1, backgroundColor: colors.background },
  coachKeyboard: { flex: 1 },
  coachHeader: {
    height: 68,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#20231F",
    flexDirection: "row",
    alignItems: "center",
  },
  coachBack: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#343934",
    alignItems: "center",
    justifyContent: "center",
  },
  coachBackText: { color: colors.text, fontSize: 27, lineHeight: 28, marginTop: -3 },
  coachIdentity: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center" },
  coachPortrait: {
    width: 35,
    height: 35,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.lime,
    backgroundColor: "#131713",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
  },
  coachPortraitText: { color: colors.text, fontSize: 12, fontWeight: "900" },
  coachName: { color: colors.text, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  coachOnlineRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  coachOnlineDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.lime, marginRight: 5 },
  coachOnlineText: { color: colors.muted, fontSize: 6, fontWeight: "800", letterSpacing: 0.8 },
  coachHeaderSpacer: { width: 38 },
  coachConversation: { padding: 16, paddingBottom: 24 },
  coachContextCard: {
    backgroundColor: "#101310",
    borderWidth: 1,
    borderColor: "#2A3028",
    borderRadius: 20,
    padding: 17,
    marginBottom: 20,
  },
  coachContextEyebrow: { color: colors.lime, fontSize: 7, fontWeight: "900", letterSpacing: 1.4 },
  coachContextTitle: { color: colors.text, fontSize: 20, fontWeight: "900", marginTop: 7, letterSpacing: -0.5 },
  coachContextText: { color: colors.muted, fontSize: 11, lineHeight: 16, marginTop: 7 },
  coachBubbleRow: { flexDirection: "row", alignItems: "flex-end", marginBottom: 12, maxWidth: "91%" },
  coachBubbleMark: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.lime,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  coachBubbleMarkText: { color: colors.text, fontSize: 9, fontWeight: "900" },
  coachBubble: { flexShrink: 1, backgroundColor: "#171A17", borderRadius: 16, borderBottomLeftRadius: 4, padding: 13 },
  coachBubbleText: { color: "#E5E9E3", fontSize: 11, lineHeight: 16 },
  coachFallbackText: {
    color: "#A7ADA5",
    fontSize: 9,
    lineHeight: 13,
    marginLeft: 44,
    marginTop: -4,
  },
  coachQuickActions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginLeft: 36, marginBottom: 20 },
  coachQuickAction: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#343A33",
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  coachQuickActionActive: { borderColor: colors.lime, backgroundColor: "#18200E" },
  coachQuickActionText: { color: "#C7CCC4", fontSize: 9, fontWeight: "700" },
  coachQuickActionTextActive: { color: colors.lime },
  userBubble: {
    alignSelf: "flex-end",
    maxWidth: "82%",
    backgroundColor: "#315E1D",
    borderRadius: 16,
    borderBottomRightRadius: 4,
    padding: 13,
    marginBottom: 14,
  },
  userBubbleText: { color: "#F6FAF2", fontSize: 11, lineHeight: 16 },
  coachAdjustmentCard: {
    marginLeft: 36,
    backgroundColor: "#101310",
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#354719",
    padding: 15,
    marginBottom: 10,
  },
  coachAdjustmentTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 13 },
  coachAdjustmentLabel: { color: colors.text, fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  coachAdjustmentBadge: {
    color: colors.lime,
    backgroundColor: "#25330F",
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
    fontSize: 6,
    fontWeight: "900",
    letterSpacing: 0.8,
  },
  coachChangeRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  coachChangeCheck: { color: colors.lime, fontSize: 12, fontWeight: "900", width: 22 },
  coachChangeText: { color: "#C8CDC6", fontSize: 10, flex: 1 },
  coachApplyButton: {
    height: 43,
    borderRadius: 13,
    backgroundColor: colors.lime,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  coachApplyButtonDone: { backgroundColor: "#91B927" },
  coachApplyButtonText: { color: colors.ink, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  coachStartButton: {
    height: 43,
    borderRadius: 13,
    borderWidth: 1,
    borderColor: colors.lime,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    marginTop: 9,
  },
  coachStartButtonText: { color: colors.text, fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  coachStartButtonArrow: { color: colors.lime, fontSize: 17, fontWeight: "900" },
  coachComposer: {
    minHeight: 70,
    borderTopWidth: 1,
    borderTopColor: "#222622",
    backgroundColor: "#090A09",
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
  },
  coachInput: {
    flex: 1,
    minHeight: 45,
    borderRadius: 23,
    backgroundColor: "#151815",
    borderWidth: 1,
    borderColor: "#2B302B",
    color: colors.text,
    fontSize: 11,
    paddingHorizontal: 16,
  },
  coachSend: {
    width: 43,
    height: 43,
    borderRadius: 22,
    backgroundColor: colors.lime,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },
  coachSendDisabled: { opacity: 0.35 },
  coachSendText: { color: colors.ink, fontSize: 20, fontWeight: "900", marginTop: -2 },
  progressScreen: { flex: 1, backgroundColor: colors.background },
  progressContent: { paddingHorizontal: 20, paddingBottom: 28 },
  progressHeader: {
    height: 58,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  progressBack: {
    width: 35,
    height: 35,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#30352F",
  },
  progressBackText: { color: colors.text, fontSize: 28, lineHeight: 29, marginTop: -2 },
  progressHeaderTitle: { color: colors.text, fontSize: 10, fontWeight: "900", letterSpacing: 2 },
  progressHeaderSpacer: { width: 35 },
  progressEyebrow: {
    color: colors.lime,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.4,
    marginTop: 14,
  },
  progressTitle: {
    color: colors.text,
    fontSize: 38,
    lineHeight: 41,
    fontWeight: "800",
    letterSpacing: -1.5,
    marginTop: 10,
  },
  progressSubtitle: { color: colors.muted, fontSize: 13, lineHeight: 19, marginTop: 9 },
  progressHero: {
    minHeight: 118,
    borderRadius: 22,
    marginTop: 22,
    paddingHorizontal: 19,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(200,255,50,0.28)",
    backgroundColor: "rgba(200,255,50,0.07)",
  },
  progressScoreValue: { color: colors.text, fontSize: 40, fontWeight: "900", letterSpacing: -1.5 },
  progressScoreLabel: { color: colors.lime, fontSize: 7, fontWeight: "900", letterSpacing: 1.3, marginTop: 2 },
  progressHeroBadge: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 5,
    borderColor: colors.lime,
    backgroundColor: "#0C0F0B",
  },
  progressHeroBadgeValue: { color: colors.text, fontSize: 24, fontWeight: "900" },
  progressHeroBadgeLabel: { color: colors.muted, fontSize: 5, fontWeight: "900", letterSpacing: 0.7 },
  progressMetrics: {
    minHeight: 86,
    borderRadius: 20,
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#252A24",
    backgroundColor: colors.surface,
  },
  progressMetric: { flex: 1, alignItems: "center" },
  progressMetricDivider: { width: 1, height: 37, backgroundColor: "#2C312B" },
  progressMetricValue: { color: colors.text, fontSize: 23, fontWeight: "900" },
  progressMetricLabel: { color: colors.muted, fontSize: 6, fontWeight: "900", letterSpacing: 1, marginTop: 4 },
  progressSection: {
    borderRadius: 20,
    marginTop: 12,
    padding: 17,
    borderWidth: 1,
    borderColor: "#252A24",
    backgroundColor: colors.surface,
  },
  progressSectionTitle: { color: colors.text, fontSize: 9, fontWeight: "900", letterSpacing: 1.4, marginBottom: 14 },
  progressRowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  progressRowLabel: { color: colors.muted, fontSize: 10 },
  progressRowValue: { color: colors.text, fontSize: 10, fontWeight: "800" },
  progressRowPositive: { color: colors.lime, fontSize: 10, fontWeight: "900" },
  analysisProgressTrack: { height: 5, borderRadius: 3, backgroundColor: "#242924", marginTop: 8, overflow: "hidden" },
  analysisProgressFill: { height: "100%", borderRadius: 3, backgroundColor: colors.lime },
  progressPriority: {
    marginTop: 18,
    paddingTop: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#292D28",
  },
  progressPriorityLabel: { color: colors.muted, fontSize: 7, fontWeight: "900", letterSpacing: 1 },
  progressPriorityValue: { color: colors.text, fontSize: 10, fontWeight: "800" },
  progressCoachCard: {
    borderRadius: 20,
    marginTop: 12,
    padding: 15,
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#111510",
  },
  progressCoachMark: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.lime,
  },
  progressCoachMarkText: { color: colors.text, fontSize: 11, fontWeight: "900" },
  progressCoachCopy: { flex: 1, marginLeft: 12 },
  progressCoachLabel: { color: colors.lime, fontSize: 7, fontWeight: "900", letterSpacing: 1 },
  progressCoachText: { color: "#C4CAC1", fontSize: 10, lineHeight: 15, marginTop: 5 },
  progressButton: {
    height: 57,
    borderRadius: 29,
    marginTop: 14,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.lime,
  },
  progressButtonText: { color: colors.ink, fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  progressButtonArrow: { color: colors.ink, fontSize: 20, fontWeight: "800" },
});
