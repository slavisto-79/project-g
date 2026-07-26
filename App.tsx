import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  ImageBackground,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  useWindowDimensions,
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

type Screen = "splash" | "welcome" | "interview" | "dashboard" | "workout";

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
                {answers.duration ?? "45"} min · {equipmentLabels[answers.equipment ?? ""] ?? "Your equipment"} · 6 exercises
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
  profile,
}: {
  onStartWorkout: () => void;
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
          <Text style={styles.workoutMeta}>3 guided exercises · Personalized intensity</Text>
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
          ["○", "MORE"],
        ].map(([icon, label], index) => (
          <Pressable key={label} style={styles.navItem}>
            <Text style={[styles.navIcon, index === 0 && styles.navActive]}>{icon}</Text>
            <Text style={[styles.navLabel, index === 0 && styles.navActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>
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
    workoutExercises[0]!,
    {
      ...workoutExercises[2]!,
      name: "Dumbbell Romanian Deadlift",
      target: "Glutes & hamstrings · Controlled",
      phases: ["HINGE", "STRETCH", "DRIVE"],
      formFrames: [
        require("./assets/exercises/dumbbell-romanian-deadlift/start.jpg"),
        require("./assets/exercises/dumbbell-romanian-deadlift/finish.jpg"),
      ],
      poseGuide: poseGuides.hinge!,
    },
    workoutExercises[1]!,
  ];
  const maleExercises: WorkoutExercise[] = [
    {
      ...workoutExercises[1]!,
      name: "Dumbbell Shoulder Press",
      target: "Shoulders · Strength",
      phases: ["LOWER", "BRACE", "PRESS"],
      formFrames: [
        require("./assets/exercises/dumbbell-shoulder-press/start.jpg"),
        require("./assets/exercises/dumbbell-shoulder-press/finish.jpg"),
      ],
      poseGuide: poseGuides.shoulder!,
    },
    workoutExercises[2]!,
    {
      ...workoutExercises[1]!,
      name: "Dumbbell Bench Press",
      target: "Chest · Strength",
    },
  ];
  const selectedBase =
    profile.sex === "female" ? femaleExercises : profile.sex === "male" ? maleExercises : workoutExercises;
  const exercises = selectedBase.map((exercise) => ({
    ...exercise,
    reps,
    tempo: profile.age === "55-plus" ? "3–1–2" : exercise.tempo,
    weight:
      exercise.name === "Goblet Squat"
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

function PoseLayer({ segments }: { segments: PoseSegment[] }) {
  const joints = Array.from(
    new Map(
      segments.flatMap(([x1, y1, x2, y2]) => [
        [`${x1}-${y1}`, [x1, y1] as const],
        [`${x2}-${y2}`, [x2, y2] as const],
      ]),
    ).values(),
  );

  return (
    <View pointerEvents="none" style={styles.poseCanvas}>
      {segments.map(([x1, y1, x2, y2], index) => {
        const dxPixels = (x2 - x1) * 850;
        const dyPixels = (y2 - y1) * 567;
        const lengthPercent = (Math.hypot(dxPixels, dyPixels) / 850) * 100;
        const angle = Math.atan2(dyPixels, dxPixels) * (180 / Math.PI);
        return (
          <View
            key={`line-${index}`}
            style={[
              styles.poseLine,
              {
                left: `${((x1 + x2) / 2) * 100 - lengthPercent / 2}%`,
                top: `${((y1 + y2) / 2) * 100}%`,
                width: `${lengthPercent}%`,
                transform: [{ rotate: `${angle}deg` }],
              },
            ]}
          />
        );
      })}
      {joints.map(([x, y], index) => (
        <View
          key={`joint-${index}`}
          style={[styles.poseJoint, { left: `${x * 100}%`, top: `${y * 100}%` }]}
        />
      ))}
    </View>
  );
}

function ExerciseFormFrames({
  frames,
  phaseIndex,
  guide,
}: {
  frames: [number, number];
  phaseIndex: number;
  guide: PoseGuide;
}) {
  const isWorkingPosition = phaseIndex < 2;
  const activeFrame = isWorkingPosition ? frames[1] : frames[0];
  const activeGuide = isWorkingPosition ? guide.finish : guide.start;

  return (
    <View style={StyleSheet.absoluteFill}>
      <Image source={activeFrame} style={styles.exerciseFrameBackdrop} resizeMode="cover" />
      <View style={styles.exerciseFrameBackdropShade} />
      <Image source={activeFrame} style={styles.exerciseVideo} resizeMode="contain" />
      <View pointerEvents="none" style={styles.poseFrameHost}>
        <View style={styles.poseFrame}>
          <PoseLayer segments={activeGuide} />
        </View>
      </View>
    </View>
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

  useEffect(() => {
    const phaseTimer = setInterval(() => setPhaseIndex((value) => (value + 1) % 3), 1100);
    return () => clearInterval(phaseTimer);
  }, []);

  return (
    <View style={styles.demoStage}>
      <ExerciseFormFrames frames={exercise.formFrames} phaseIndex={phaseIndex} guide={exercise.poseGuide} />
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
  onExit,
  profile,
}: {
  onExit: () => void;
  profile: Record<string, string>;
}) {
  const { width } = useWindowDimensions();
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [completedSets, setCompletedSets] = useState<boolean[]>([false, false, false]);
  const [restSeconds, setRestSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [workoutComplete, setWorkoutComplete] = useState(false);
  const personalizedExercises = createWorkout(profile);
  const exercise = personalizedExercises[exerciseIndex] ?? personalizedExercises[0]!;
  const exerciseVisualHeight = Math.min(380, Math.max(230, width * 0.38));
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
    if (!completedSets[index]) setRestSeconds(60);
  };

  const nextExercise = () => {
    if (exerciseIndex < personalizedExercises.length - 1) {
      setExerciseIndex((current) => current + 1);
      setCompletedSets([false, false, false]);
      setRestSeconds(0);
    }
  };
  const finishWorkout = () => {
    setRestSeconds(0);
    setWorkoutComplete(true);
  };

  const completedCount = completedSets.filter(Boolean).length;
  const workoutProgress = (exerciseIndex + completedCount / 3) / personalizedExercises.length;
  const elapsedLabel = `${String(Math.floor(elapsedSeconds / 60)).padStart(2, "0")}:${String(
    elapsedSeconds % 60,
  ).padStart(2, "0")}`;
  const remainingSeconds = Math.max(0, 45 * 60 - elapsedSeconds);
  const remainingLabel = `${Math.floor(remainingSeconds / 60)}:${String(remainingSeconds % 60).padStart(2, "0")}`;

  if (workoutComplete) {
    return (
      <SafeAreaView style={styles.workoutCompleteScreen}>
        <View style={styles.completeGlow} />
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
          accessibilityLabel="Return to dashboard"
          onPress={onExit}
          style={styles.completeButton}
        >
          <Text style={styles.completeButtonText}>RETURN TO DASHBOARD</Text>
          <Text style={styles.completeButtonArrow}>→</Text>
        </Pressable>
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
          <Pressable style={styles.exerciseInfo}><Text style={styles.exerciseInfoText}>i</Text></Pressable>
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
          accessibilityLabel="Next exercise"
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
    </SafeAreaView>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>("splash");
  const [profile, setProfile] = useState<Record<string, string>>({});

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
          <DashboardScreen profile={profile} onStartWorkout={() => setScreen("workout")} />
        )}
        {screen === "workout" && (
          <ActiveWorkoutScreen profile={profile} onExit={() => setScreen("dashboard")} />
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
    paddingHorizontal: 22,
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
    flex: 1,
    paddingHorizontal: 18,
    paddingTop: 15,
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
});
