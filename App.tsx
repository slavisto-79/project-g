import { createElement, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Image,
  ImageBackground,
  type ImageSourcePropType,
  KeyboardAvoidingView,
  Modal,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
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
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import {
  buildProgram,
  determineSplitDay,
  splitDaySlotCount,
  type ProgramBuilderProfile,
  type SplitDay,
} from "./lib/programBuilder";
import type { ExerciseTag, MovementPattern, PrimaryMuscle } from "./lib/exerciseCatalog";

const colors = {
  background: "#050505",
  surface: "#111311",
  text: "#F4F7F2",
  muted: "#A7ADA5",
  lime: "#C8FF32",
  ink: "#0A0B09",
};

type Screen =
  | "splash"
  | "welcome"
  | "interview"
  | "dashboard"
  | "workout"
  | "progress"
  | "coach"
  | "nutrition"
  | "recipes"
  | "recipeLibrary"
  | "recipeDetail"
  | "dietPlan"
  | "auth"
  | "resetPassword"
  | "profile";

type InterviewAnswer = {
  label: string;
  value: string;
};

type ChoiceQuestion = {
  kind: "choice";
  id: string;
  kicker: string;
  title: string;
  subtitle: string;
  answers: InterviewAnswer[];
};

type PickerQuestion = {
  kind: "picker";
  id: string;
  kicker: string;
  title: string;
  subtitle: string;
  min: number;
  max: number;
  step: number;
  unit: string;
  defaultValue: number;
};

type InterviewQuestion = ChoiceQuestion | PickerQuestion;

const interviewQuestions: InterviewQuestion[] = [
  {
    kind: "choice",
    id: "sex",
    kicker: "PERSONALIZE YOUR TRAINING",
    title: "How should we personalize your plan?",
    subtitle: "This helps tailor training emphasis and coaching. You can change it later.",
    answers: [
      { label: "Woman", value: "female" },
      { label: "Man", value: "male" },
    ],
  },
  {
    kind: "picker",
    id: "age",
    kicker: "TRAIN FOR YOUR CURRENT STAGE",
    title: "What is your age?",
    subtitle: "Age helps us adjust recovery, exercise progression, and training volume.",
    unit: "yrs",
    min: 16,
    max: 90,
    step: 1,
    defaultValue: 30,
  },
  {
    kind: "picker",
    id: "weight",
    kicker: "BUILD YOUR ACCURATE PLAN",
    title: "What is your current weight?",
    subtitle: "This helps us recommend a more accurate starting dumbbell weight.",
    unit: "kg",
    min: 40,
    max: 150,
    step: 1,
    defaultValue: 70,
  },
  {
    kind: "picker",
    id: "height",
    kicker: "BUILD YOUR ACCURATE PLAN",
    title: "What is your height?",
    subtitle: "Height helps us fine-tune your training setup.",
    unit: "cm",
    min: 140,
    max: 210,
    step: 1,
    defaultValue: 175,
  },
  {
    kind: "choice",
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
    kind: "choice",
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
    kind: "choice",
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
    kind: "choice",
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
    kind: "choice",
    id: "equipment",
    kicker: "WHERE YOU TRAIN",
    title: "What equipment can you use?",
    subtitle: "Every exercise will match what is genuinely available to you.",
    answers: [
      { label: "Full gym", value: "gym" },
      { label: "Home gym", value: "home-gym" },
      { label: "Dumbbells and bands", value: "minimal" },
      { label: "Bodyweight only", value: "bodyweight" },
      { label: "Pull-up bar / calisthenics", value: "bars" },
    ],
  },
  {
    kind: "choice",
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

const WHEEL_ITEM_HEIGHT = 52;
const WHEEL_VISIBLE_ITEMS = 5;

function NumberWheelPicker({
  min,
  max,
  step,
  unit,
  value,
  onChange,
  itemHeight = WHEEL_ITEM_HEIGHT,
  visibleItems = WHEEL_VISIBLE_ITEMS,
  fontSize = 20,
}: {
  min: number;
  max: number;
  step: number;
  unit: string;
  value: number;
  onChange: (value: number) => void;
  itemHeight?: number;
  visibleItems?: number;
  fontSize?: number;
}) {
  const numbers = useMemo(() => {
    const list: number[] = [];
    for (let n = min; n <= max; n += step) list.push(n);
    return list;
  }, [min, max, step]);
  const scrollRef = useRef<ScrollView>(null);
  const initialIndex = Math.max(0, numbers.indexOf(value));
  const [liveIndex, setLiveIndex] = useState(initialIndex);
  const lastOffsetY = useRef(initialIndex * itemHeight);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: initialIndex * itemHeight, animated: false });
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
    // Only snap to the initial position once, when this picker mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Re-sync if `value` changes from outside (e.g. switching exercises without
  // remounting this picker, or a dev hot-reload) rather than from the user's
  // own scroll gesture, which already keeps liveIndex in step via handleScroll.
  useEffect(() => {
    const nextIndex = Math.max(0, numbers.indexOf(value));
    if (nextIndex === liveIndex) return;
    lastOffsetY.current = nextIndex * itemHeight;
    setLiveIndex(nextIndex);
    scrollRef.current?.scrollTo({ y: nextIndex * itemHeight, animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const indexFromOffset = (offsetY: number) =>
    Math.max(0, Math.min(numbers.length - 1, Math.round(offsetY / itemHeight)));

  // Mouse-wheel scrolling on web never fires onMomentumScrollEnd/onScrollEndDrag
  // (those are touch-fling events), so relying on them left the wheel stuck
  // between numbers. Instead, treat "no scroll event for a short beat" as
  // settled, regardless of input method, and force the snap ourselves.
  const commitSettledScroll = () => {
    const clampedIndex = indexFromOffset(lastOffsetY.current);
    const nextValue = numbers[clampedIndex];
    setLiveIndex(clampedIndex);
    scrollRef.current?.scrollTo({ y: clampedIndex * itemHeight, animated: true });
    if (nextValue !== undefined && nextValue !== value) onChange(nextValue);
  };

  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = event.nativeEvent.contentOffset.y;
    lastOffsetY.current = offsetY;
    setLiveIndex(indexFromOffset(offsetY));
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(commitSettledScroll, 120);
  };

  const selectIndex = (index: number) => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    const nextValue = numbers[index];
    lastOffsetY.current = index * itemHeight;
    setLiveIndex(index);
    scrollRef.current?.scrollTo({ y: index * itemHeight, animated: true });
    if (nextValue !== undefined && nextValue !== value) onChange(nextValue);
  };

  const paddingVertical = itemHeight * Math.floor(visibleItems / 2);

  return (
    <View style={[styles.wheelPicker, { height: itemHeight * visibleItems }]}>
      <View
        pointerEvents="none"
        style={[styles.wheelPickerHighlight, { top: paddingVertical, height: itemHeight }]}
      />
      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        snapToInterval={itemHeight}
        decelerationRate="fast"
        onScroll={handleScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingVertical }}
      >
        {numbers.map((number, index) => {
          const distance = Math.abs(index - liveIndex);
          const rowOpacity = distance === 0 ? 1 : distance === 1 ? 0.55 : 0.28;
          return (
            <Pressable
              key={number}
              accessibilityRole="button"
              accessibilityLabel={`${number} ${unit}`}
              onPress={() => selectIndex(index)}
              style={[styles.wheelPickerRow, { height: itemHeight }]}
            >
              <Text
                style={[
                  styles.wheelPickerText,
                  { opacity: rowOpacity, fontSize, lineHeight: itemHeight },
                  distance === 0 && styles.wheelPickerTextSelected,
                ]}
              >
                {number} {unit}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

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

function WelcomeScreen({
  onSignIn,
  onCreateAccount,
}: {
  onSignIn: () => void;
  onCreateAccount: () => void;
}) {
  const { height } = useWindowDimensions();
  const heroContentOffset = Math.max(160, Math.min(420, height * 0.38));
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
          contentContainerStyle={[styles.welcomeScrollContent, { paddingTop: heroContentOffset }]}
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
            accessibilityLabel="Create account"
            onPress={onCreateAccount}
            style={({ pressed }) => [styles.startButton, pressed && styles.startButtonPressed]}
          >
            <Text style={styles.startButtonText}>CREATE ACCOUNT</Text>
            <Text style={styles.startArrow}>↗</Text>
          </Pressable>
          <View style={styles.welcomeAuthRow}>
            <Text style={styles.welcomeAuthLabel}>Already have an account?</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Sign in" onPress={onSignIn}>
              <Text style={[styles.welcomeAuthLinkText, { textDecorationLine: "underline" }]}>Sign in</Text>
            </Pressable>
          </View>
          <Text style={styles.disclaimer}>Built for your goals. Adapted to your life.</Text>
          </Animated.View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const scheduleDayOptions: { id: string; label: string; short: string }[] = [
  { id: "mon", label: "M", short: "Mon" },
  { id: "tue", label: "T", short: "Tue" },
  { id: "wed", label: "W", short: "Wed" },
  { id: "thu", label: "T", short: "Thu" },
  { id: "fri", label: "F", short: "Fri" },
  { id: "sat", label: "S", short: "Sat" },
  { id: "sun", label: "S", short: "Sun" },
];

const scheduleTimeOptions: { id: string; label: string; short: string }[] = [
  { id: "07:00", label: "Morning · 7:00 AM", short: "7 AM" },
  { id: "12:00", label: "Midday · 12:00 PM", short: "12 PM" },
  { id: "18:00", label: "Evening · 6:00 PM", short: "6 PM" },
  { id: "20:00", label: "Night · 8:00 PM", short: "8 PM" },
];

const scheduleDefaultDaysForFrequency: Record<string, string[]> = {
  "2": ["mon", "thu"],
  "3": ["mon", "wed", "fri"],
  "4": ["mon", "tue", "thu", "fri"],
  "5": ["mon", "tue", "wed", "thu", "fri"],
};

// Shared by onboarding (auto-opens once the plan is ready) and the profile
// screen (opened by tapping "How often can you train?") so both stay in sync
// instead of maintaining two copies of this picker.
function ScheduleModal({
  visible,
  onClose,
  initialDays,
  initialTime,
  frequency,
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  initialDays: string[];
  initialTime: string;
  frequency: string;
  onConfirm: (days: string[], time: string, frequency: string) => void;
}) {
  const [days, setDays] = useState<string[]>(initialDays);
  const [time, setTime] = useState(initialTime);
  const [mismatchConfirm, setMismatchConfirm] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setMismatchConfirm(false);
    setDays(initialDays.length > 0 ? initialDays : scheduleDefaultDaysForFrequency[frequency] ?? ["mon", "wed", "fri"]);
    setTime(initialTime);
    // Only reset when the modal opens, not on every parent re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const toggleDay = (id: string) => {
    // Plain add/remove -- the DONE confirmation below catches it if the final
    // count drifts from the stored weekly frequency and offers to sync it.
    setDays((current) => (current.includes(id) ? current.filter((day) => day !== id) : [...current, id]));
  };

  const handleClose = () => {
    setMismatchConfirm(false);
    onClose();
  };

  const requestDone = () => {
    if (days.length > 0 && days.length !== Number(frequency || 0)) {
      setMismatchConfirm(true);
      return;
    }
    onConfirm(days, time, frequency);
    handleClose();
  };

  const confirmMismatch = () => {
    onConfirm(days, time, String(days.length));
    handleClose();
  };

  return (
    <Modal transparent animationType="slide" visible={visible} statusBarTranslucent onRequestClose={handleClose}>
      <Pressable style={styles.exerciseInfoBackdrop} onPress={handleClose}>
        <Pressable style={styles.exerciseInfoPanel} onPress={(event) => event.stopPropagation()}>
          <View style={styles.exerciseInfoHandle} />
          <View style={styles.exerciseInfoPanelHeader}>
            <View style={styles.exerciseInfoPanelTitleWrap}>
              <Text style={styles.exerciseInfoPanelEyebrow}>REMINDERS</Text>
              <Text style={styles.exerciseInfoPanelTitle}>Day & time</Text>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={handleClose} style={styles.exerciseInfoClose}>
              <Text style={styles.exerciseInfoCloseText}>×</Text>
            </Pressable>
          </View>

          <Text style={styles.planSectionTitle}>TRAINING DAYS</Text>
          <View style={styles.scheduleDaysRow}>
            {scheduleDayOptions.map((day, index) => {
              const isSelected = days.includes(day.id);
              return (
                <Pressable
                  key={`${day.id}-${index}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Toggle ${day.id}`}
                  onPress={() => toggleDay(day.id)}
                  style={[styles.scheduleDayChip, isSelected && styles.scheduleDayChipSelected]}
                >
                  <Text style={[styles.scheduleDayChipText, isSelected && styles.scheduleDayChipTextSelected]}>
                    {day.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.planSectionTitle}>REMINDER TIME</Text>
          <View style={styles.answerList}>
            {scheduleTimeOptions.map((option) => {
              const isSelected = option.id === time;
              return (
                <Pressable
                  key={option.id}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  onPress={() => setTime(option.id)}
                  style={({ pressed }) => [
                    styles.answerCard,
                    isSelected && styles.answerCardSelected,
                    pressed && styles.answerCardPressed,
                  ]}
                >
                  <View style={[styles.answerRadio, isSelected && styles.answerRadioSelected]}>
                    {isSelected ? <View style={styles.answerRadioDot} /> : null}
                  </View>
                  <Text style={[styles.answerText, isSelected && styles.answerTextSelected]}>{option.label}</Text>
                </Pressable>
              );
            })}
          </View>

          {mismatchConfirm ? (
            <View style={styles.mismatchWarning}>
              <Text style={styles.mismatchWarningText}>
                You said {frequency || "3"}×/week in the questionnaire, but picked {days.length} day
                {days.length === 1 ? "" : "s"} here. Continue with {days.length}× and update your plan to match?
              </Text>
              <Pressable onPress={confirmMismatch} style={styles.exerciseInfoDone}>
                <Text style={styles.exerciseInfoDoneText}>YES, UPDATE MY PLAN</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Go back and adjust"
                onPress={() => setMismatchConfirm(false)}
              >
                <Text style={styles.mismatchBackText}>Go back and adjust</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={requestDone} style={styles.exerciseInfoDone}>
              <Text style={styles.exerciseInfoDoneText}>DONE</Text>
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
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
  const [reminderDays, setReminderDays] = useState<string[]>([]);
  const [reminderTime, setReminderTime] = useState<string>("");
  const toggleFrequencyDay = (id: string) => {
    setReminderDays((current) => {
      const next = current.includes(id) ? current.filter((day) => day !== id) : [...current, id];
      // Keep the "how many days" answer in lockstep with the actual days picked,
      // so there's one source of truth instead of asking for a count separately.
      setAnswers((currentAnswers) => ({ ...currentAnswers, frequency: String(next.length) }));
      return next;
    });
  };
  const finishWithReminders = () => {
    onFinish({
      ...answers,
      ...(reminderDays.length > 0 ? { reminderDays: reminderDays.join(",") } : {}),
      ...(reminderTime ? { reminderTime } : {}),
    });
  };
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
    bars: "Pull-up bar",
  };

  useEffect(() => {
    if (planStage !== "generating") return;
    const timer = setTimeout(() => setPlanStage("ready"), 2300);
    return () => clearTimeout(timer);
  }, [planStage]);

  useEffect(() => {
    if (question?.kind === "picker" && answers[question.id] === undefined) {
      setAnswers((current) => ({ ...current, [question.id]: String(question.defaultValue) }));
    }
  }, [question, answers]);

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
            onPress={() =>
              onStartWorkout({
                ...answers,
                ...(reminderDays.length > 0 ? { reminderDays: reminderDays.join(",") } : {}),
                ...(reminderTime ? { reminderTime } : {}),
              })
            }
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

          <Pressable onPress={finishWithReminders} style={styles.startButton}>
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
            {question.id === "frequency" ? (
              <>
                <View style={[styles.scheduleDaysRow, { marginTop: 24 }]}>
                  {scheduleDayOptions.map((day, index) => {
                    const isSelected = reminderDays.includes(day.id);
                    return (
                      <Pressable
                        key={`${day.id}-${index}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Toggle ${day.id}`}
                        onPress={() => toggleFrequencyDay(day.id)}
                        style={[styles.scheduleDayChip, isSelected && styles.scheduleDayChipSelected]}
                      >
                        <Text style={[styles.scheduleDayChipText, isSelected && styles.scheduleDayChipTextSelected]}>
                          {day.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <Text style={[styles.planSectionTitle, { marginTop: 22 }]}>REMINDER TIME · OPTIONAL</Text>
                <View style={styles.answerList}>
                  {scheduleTimeOptions.map((time) => {
                    const isSelected = time.id === reminderTime;
                    return (
                      <Pressable
                        key={time.id}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        onPress={() => setReminderTime(isSelected ? "" : time.id)}
                        style={({ pressed }) => [
                          styles.answerCard,
                          isSelected && styles.answerCardSelected,
                          pressed && styles.answerCardPressed,
                        ]}
                      >
                        <View style={[styles.answerRadio, isSelected && styles.answerRadioSelected]}>
                          {isSelected ? <View style={styles.answerRadioDot} /> : null}
                        </View>
                        <Text style={[styles.answerText, isSelected && styles.answerTextSelected]}>{time.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : question.kind === "picker" ? (
              <View style={styles.wheelPickerWrap}>
                <NumberWheelPicker
                  min={question.min}
                  max={question.max}
                  step={question.step}
                  unit={question.unit}
                  value={Number(selected ?? question.defaultValue)}
                  onChange={(next) => selectAnswer(String(next))}
                />
              </View>
            ) : (
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
            )}
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

function ProfileScreen({
  profile,
  onUpdateProfile,
  onBack,
  session,
  onOpenAccount,
  onLogout,
  trialDaysLeft,
  trialEndsAtLabel,
}: {
  profile: Record<string, string>;
  onUpdateProfile: (id: string, value: string) => void;
  onBack: () => void;
  session: { email: string } | null;
  onOpenAccount: (mode: "signup" | "login") => void;
  onLogout: () => void;
  trialDaysLeft: number | null;
  trialEndsAtLabel: string | null;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState<string>("");
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const editingQuestion = interviewQuestions.find((question) => question.id === editingId) ?? null;

  // Shrink each profile row just enough that all of them plus the header/account
  // bar fit on one screen without scrolling, instead of a fixed height that
  // overflows on smaller phones.
  const { height: windowHeight } = useWindowDimensions();
  const chromeHeight = 70 + 50 + (trialDaysLeft !== null ? 46 : 0) + 30 + 40;
  const availableForRows = Math.max(280, windowHeight - chromeHeight);
  const profileRowHeight = Math.max(40, Math.min(52, availableForRows / interviewQuestions.length));

  const startEditing = (question: InterviewQuestion) => {
    // "How often can you train?" also drives the reminders day/time picker --
    // edit both together instead of just the plain number.
    if (question.id === "frequency") {
      setScheduleModalOpen(true);
      return;
    }
    setDraftValue(profile[question.id] ?? (question.kind === "picker" ? String(question.defaultValue) : ""));
    setEditingId(question.id);
  };

  const saveEdit = () => {
    if (!editingQuestion || !draftValue) return;
    onUpdateProfile(editingQuestion.id, draftValue);
    setEditingId(null);
  };

  const formatValue = (question: InterviewQuestion): string => {
    const value = profile[question.id];
    if (question.kind === "picker") {
      return `${value ?? question.defaultValue} ${question.unit}`;
    }
    if (question.id === "frequency" && value) {
      // The day/time picker allows any count from 1-7, not just the
      // original 2/3/4/5 preset answers, so format it directly.
      const count = Number(value);
      return Number.isFinite(count) ? `${count} day${count === 1 ? "" : "s"} a week` : "Not set";
    }
    return question.answers.find((answer) => answer.value === value)?.label ?? "Not set";
  };

  if (editingQuestion) {
    return (
      <SafeAreaView style={styles.preview}>
        <View style={styles.interviewHeader}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cancel"
            onPress={() => setEditingId(null)}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>‹</Text>
          </Pressable>
          <Text style={[styles.progressText, { flex: 1, textAlign: "center" }]}>EDIT</Text>
          <View style={{ width: 44 }} />
        </View>
        <View style={styles.questionContent}>
          <Text style={styles.previewStep}>{editingQuestion.kicker}</Text>
          <Text style={styles.previewTitle}>{editingQuestion.title}</Text>
          <Text style={styles.previewBody}>{editingQuestion.subtitle}</Text>
          {editingQuestion.kind === "picker" ? (
            <View style={styles.wheelPickerWrap}>
              <NumberWheelPicker
                min={editingQuestion.min}
                max={editingQuestion.max}
                step={editingQuestion.step}
                unit={editingQuestion.unit}
                value={Number(draftValue || editingQuestion.defaultValue)}
                onChange={(next) => setDraftValue(String(next))}
              />
            </View>
          ) : (
            <View style={styles.answerList}>
              {editingQuestion.answers.map((answer) => {
                const isSelected = answer.value === draftValue;
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    key={answer.value}
                    onPress={() => setDraftValue(answer.value)}
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
          )}
        </View>
        <View style={styles.interviewFooter}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Save"
            disabled={!draftValue}
            onPress={saveEdit}
            style={({ pressed }) => [
              styles.continueButton,
              !draftValue && styles.continueButtonDisabled,
              pressed && draftValue ? styles.startButtonPressed : null,
            ]}
          >
            <Text style={[styles.continueButtonText, !draftValue && styles.continueButtonTextDisabled]}>
              SAVE
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.dashboard}>
      <View style={styles.interviewHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.backButton}>
          <Text style={styles.backButtonText}>‹</Text>
        </Pressable>
        <Text style={[styles.progressText, { flex: 1, textAlign: "center" }]}>PROFILE</Text>
        <View style={{ width: 44 }} />
      </View>
      <ScrollView
        style={styles.dashboardBody}
        contentContainerStyle={styles.dashboardBodyContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.accountBar}>
          {session ? (
            <>
              <View style={[styles.testModeIdentity, { flexShrink: 1 }]}>
                <View style={styles.testModeDot} />
                <Text style={[styles.testModeLabel, { flexShrink: 1 }]} numberOfLines={1}>
                  SIGNED IN · {session.email}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Log out"
                onPress={onLogout}
                style={styles.testModeReset}
              >
                <Text style={styles.testModeResetText}>LOG OUT</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.accountPromptText}>Save your progress across devices</Text>
              <View style={styles.accountActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Sign in"
                  onPress={() => onOpenAccount("login")}
                  style={styles.accountButton}
                >
                  <Text style={styles.accountButtonText}>SIGN IN</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Create account"
                  onPress={() => onOpenAccount("signup")}
                  style={styles.accountButton}
                >
                  <Text style={styles.accountButtonText}>CREATE ACCOUNT</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        {trialDaysLeft !== null ? (
          <View style={[styles.trialBar, trialDaysLeft === 0 && styles.trialBarEnded]}>
            <Text style={[styles.trialBarText, trialDaysLeft === 0 && styles.trialBarTextEnded]}>
              {trialDaysLeft > 0
                ? `${trialDaysLeft} DAY${trialDaysLeft === 1 ? "" : "S"} LEFT · ENDS ${trialEndsAtLabel}`
                : `YOUR TRIAL ENDED ${trialEndsAtLabel}`}
            </Text>
          </View>
        ) : null}

        <Text style={styles.sectionEyebrow}>YOUR PROFILE</Text>
        <View style={styles.profileList}>
          {interviewQuestions.map((question, index) => (
            <Pressable
              key={question.id}
              accessibilityRole="button"
              accessibilityLabel={`Edit ${question.title}`}
              onPress={() => startEditing(question)}
              style={({ pressed }) => [
                styles.profileRow,
                { minHeight: profileRowHeight },
                index === interviewQuestions.length - 1 && { borderBottomWidth: 0 },
                pressed && { opacity: 0.8 },
              ]}
            >
              <Text style={styles.profileRowLabel}>{question.title}</Text>
              <View style={styles.profileRowRight}>
                <Text style={styles.profileRowValue} numberOfLines={1}>
                  {formatValue(question)}
                </Text>
                <Text style={styles.cardChevron}>›</Text>
              </View>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <ScheduleModal
        visible={scheduleModalOpen}
        onClose={() => setScheduleModalOpen(false)}
        initialDays={profile.reminderDays ? profile.reminderDays.split(",") : []}
        initialTime={profile.reminderTime ?? ""}
        frequency={profile.frequency ?? "3"}
        onConfirm={(days, time, frequency) => {
          onUpdateProfile("reminderDays", days.join(","));
          onUpdateProfile("reminderTime", time);
          if (frequency !== profile.frequency) onUpdateProfile("frequency", frequency);
        }}
      />
    </SafeAreaView>
  );
}

type BottomNavKey = "dashboard" | "nutrition" | "progress" | "coach";

function BottomNav({
  active,
  onHome,
  onNutrition,
  onProgress,
  onCoach,
}: {
  active: BottomNavKey;
  onHome: () => void;
  onNutrition: () => void;
  onProgress: () => void;
  onCoach: () => void;
}) {
  const items: { key: BottomNavKey; icon: string; label: string; onPress: () => void }[] = [
    { key: "dashboard", icon: "🏠", label: "HOME", onPress: onHome },
    { key: "nutrition", icon: "🥗", label: "NUTRITION", onPress: onNutrition },
    { key: "progress", icon: "📈", label: "PROGRESS", onPress: onProgress },
    { key: "coach", icon: "🎯", label: "COACH", onPress: onCoach },
  ];

  return (
    <View style={styles.bottomNav}>
      {items.map((item) => {
        const isActive = item.key === active;
        return (
          <Pressable
            key={item.label}
            accessibilityRole="button"
            accessibilityLabel={item.label}
            onPress={isActive ? undefined : item.onPress}
            style={styles.navItem}
          >
            <View style={[styles.navIconWrap, isActive && styles.navIconWrapActive]}>
              <Text style={[styles.navIcon, !isActive && styles.navIconInactive]}>{item.icon}</Text>
            </View>
            <Text style={[styles.navLabel, isActive && styles.navActive]}>{item.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function DashboardScreen({
  onStartWorkout,
  onOpenCoach,
  onOpenNutrition,
  onOpenProgress,
  session,
  onOpenAccount,
  onLogout,
  onOpenProfile,
  profile,
  nutritionTotals,
  workoutHistory,
  trialDaysLeft,
}: {
  onStartWorkout: () => void;
  onOpenCoach: () => void;
  onOpenNutrition: () => void;
  onOpenProgress: () => void;
  session: { email: string } | null;
  onOpenAccount: (mode: "signup" | "login") => void;
  onLogout: () => void;
  onOpenProfile: () => void;
  profile: Record<string, string>;
  nutritionTotals: NutritionTotals;
  workoutHistory: WorkoutHistoryEntry[];
  trialDaysLeft: number | null;
}) {
  const reminderDays = profile.reminderDays ? profile.reminderDays.split(",") : [];
  const todaySplit = determineSplitDay(reminderDays, recentSplitDaysFromHistory(workoutHistory));
  const workoutName = todaySplit.label;
  const exerciseCount = splitDaySlotCount(todaySplit.day);
  const { isDeload } = getMesocycleWeek(workoutHistory);
  const weeklyGoal = profile.frequency ?? "3";
  const thisWeekCount = workoutHistory.filter((entry) => isWithinLastDays(entry.date, 7)).length;
  const lastWorkout = workoutHistory[0];
  const readiness = computeReadiness(workoutHistory);

  return (
    <SafeAreaView style={styles.dashboard}>
      <View style={styles.dashboardHeader}>
        <View>
          <Text style={styles.dashboardGreeting}>GOOD MORNING</Text>
          <Text style={styles.dashboardName}>Ready for today?</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Open your profile"
          onPress={onOpenProfile}
          style={styles.myProfilePill}
        >
          <View style={styles.avatarStatus} />
          <Text style={styles.myProfilePillText}>MY PROFILE</Text>
          <Text style={styles.dashboardAvatarChevron}>›</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.dashboardBody}
        contentContainerStyle={styles.dashboardBodyContent}
        showsVerticalScrollIndicator={false}
      >

        <View style={styles.accountBar}>
          {session ? (
            <>
              <View style={[styles.testModeIdentity, { flexShrink: 1 }]}>
                <View style={styles.testModeDot} />
                <Text style={[styles.testModeLabel, { flexShrink: 1 }]} numberOfLines={1}>
                  SIGNED IN · {session.email}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Log out"
                onPress={onLogout}
                style={styles.testModeReset}
              >
                <Text style={styles.testModeResetText}>LOG OUT</Text>
              </Pressable>
            </>
          ) : (
            <>
              <Text style={styles.accountPromptText}>Save your progress across devices</Text>
              <View style={styles.accountActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Sign in"
                  onPress={() => onOpenAccount("login")}
                  style={styles.accountButton}
                >
                  <Text style={styles.accountButtonText}>SIGN IN</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Create account"
                  onPress={() => onOpenAccount("signup")}
                  style={styles.accountButton}
                >
                  <Text style={styles.accountButtonText}>CREATE ACCOUNT</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>

        {trialDaysLeft !== null ? (
          <View style={[styles.trialBar, trialDaysLeft === 0 && styles.trialBarEnded]}>
            <Text style={[styles.trialBarText, trialDaysLeft === 0 && styles.trialBarTextEnded]}>
              {trialDaysLeft > 0
                ? `${trialDaysLeft} DAY${trialDaysLeft === 1 ? "" : "S"} LEFT IN YOUR TRIAL`
                : "YOUR TRIAL HAS ENDED"}
            </Text>
          </View>
        ) : null}

        <View style={styles.workoutCard}>
          <View style={styles.workoutCardTop}>
            <View style={styles.workoutTypeBadge}>
              <Text style={styles.workoutTypeText}>TODAY’S WORKOUT</Text>
            </View>
            <Text style={styles.workoutDuration}>{profile.duration ?? "45"} MIN</Text>
          </View>
          <Text style={styles.workoutTitle}>{workoutName}</Text>
          <Text style={styles.workoutMeta}>
            {exerciseCount} guided exercises · {isDeload ? "Deload week — lighter load" : "Personalized intensity"}
          </Text>
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
            <Text style={styles.recoveryValue}>{readiness.score}</Text>
            <Text style={styles.recoveryLabel}>READY</Text>
          </View>
          <View style={styles.readinessCopy}>
            <Text style={styles.sectionEyebrow}>TODAY’S READINESS</Text>
            <Text style={styles.readinessTitle}>{readiness.title}</Text>
            <Text style={styles.readinessHint}>{readiness.hint}</Text>
          </View>
        </View>

        <Text style={styles.quickTitle}>QUICK OVERVIEW</Text>
        <View style={styles.metricGrid}>
          {[
            [`${thisWeekCount} / ${weeklyGoal}`, "WORKOUTS"],
            [nutritionTotals.calories ? nutritionTotals.calories.toLocaleString() : "0", "CALORIES"],
            [`${nutritionTotals.protein}g`, "PROTEIN"],
          ].map(([value, label]) => (
            <View style={styles.metricCard} key={label}>
              <Text style={styles.metricValue}>{value}</Text>
              <Text style={styles.metricLabel}>{label}</Text>
            </View>
          ))}
        </View>

        {lastWorkout ? (
          <View style={styles.lastWorkoutCard}>
            <View>
              <Text style={styles.weekLabel}>LAST WORKOUT</Text>
              <Text style={styles.weekValue}>
                {lastWorkout.title} · {formatHistoryDuration(lastWorkout.seconds)}
              </Text>
            </View>
            <View style={styles.lastWorkoutScore}>
              <Text style={styles.lastWorkoutScoreText}>{lastWorkout.calories} kcal</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      <BottomNav
        active="dashboard"
        onHome={() => {}}
        onNutrition={onOpenNutrition}
        onProgress={onOpenProgress}
        onCoach={onOpenCoach}
      />
    </SafeAreaView>
  );
}

type NutritionTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

type ExerciseProgress = {
  weightKg: number;
  reps: number;
};

type WorkoutHistoryExercise = {
  name: string;
  weightKg: number | null;
  reps: number;
  sets: number;
};

type WorkoutHistoryEntry = {
  id: string;
  date: string;
  title: string;
  exercises: number;
  sets: number;
  seconds: number;
  calories: number;
  exerciseBreakdown?: WorkoutHistoryExercise[];
  splitDay?: SplitDay;
};

function formatHistoryDate(iso: string): string {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function formatHistoryDuration(seconds: number): string {
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

function isWithinLastDays(iso: string, days: number): boolean {
  const parsed = new Date(iso).getTime();
  if (Number.isNaN(parsed)) return false;
  return Date.now() - parsed <= days * 24 * 60 * 60 * 1000;
}

type ReadinessInfo = { score: number; title: string; hint: string };

// A simple recovery-time heuristic, not a biometric measurement -- we have no
// sleep/HRV data, only workout history, so this approximates readiness from
// how long it's been since the last session.
// Null when there's no previous workout to compare against.
function hoursSinceLastWorkout(workoutHistory: WorkoutHistoryEntry[]): number | null {
  const lastWorkoutMs = new Date(workoutHistory[0]?.date ?? "").getTime();
  if (Number.isNaN(lastWorkoutMs)) return null;
  return (Date.now() - lastWorkoutMs) / (60 * 60 * 1000);
}

// A simple 4-week mesocycle: 3 weeks of normal progressive overload, then one
// deload week (lighter weight, one fewer set) so fatigue doesn't just stack
// forever. Week is anchored to the very first logged workout, not a
// separately-stored "program start date" we don't have.
function getMesocycleWeek(workoutHistory: WorkoutHistoryEntry[]): { weekNumber: number; isDeload: boolean } {
  const firstWorkout = workoutHistory[workoutHistory.length - 1];
  if (!firstWorkout) return { weekNumber: 1, isDeload: false };
  const firstMs = new Date(firstWorkout.date).getTime();
  if (Number.isNaN(firstMs)) return { weekNumber: 1, isDeload: false };
  const daysSince = (Date.now() - firstMs) / (24 * 60 * 60 * 1000);
  const weekInCycle = (Math.floor(daysSince / 7) % 4) + 1;
  return { weekNumber: weekInCycle, isDeload: weekInCycle === 4 };
}

// Most-recent-first, matching workoutHistory's own order -- feeds determineSplitDay's
// least-recently-trained balancing.
function recentSplitDaysFromHistory(workoutHistory: WorkoutHistoryEntry[]): SplitDay[] {
  return workoutHistory.map((entry) => entry.splitDay).filter((day): day is SplitDay => Boolean(day));
}

function computeReadiness(workoutHistory: WorkoutHistoryEntry[]): ReadinessInfo {
  const lastWorkout = workoutHistory[0];
  if (!lastWorkout) {
    return { score: 85, title: "Ready to start", hint: "No sessions logged yet — go for it." };
  }
  const lastWorkoutMs = new Date(lastWorkout.date).getTime();
  if (Number.isNaN(lastWorkoutMs)) {
    return { score: 85, title: "Ready to start", hint: "You’re ready for the planned session." };
  }
  const hoursSince = (Date.now() - lastWorkoutMs) / (60 * 60 * 1000);
  if (hoursSince < 8) {
    return { score: 55, title: "Still recovering", hint: "You trained recently — an easy session helps." };
  }
  if (hoursSince < 20) {
    return { score: 72, title: "Good readiness", hint: "You’re ready for the planned session." };
  }
  if (hoursSince < 40) {
    return { score: 88, title: "Fully recovered", hint: "Good day to push a bit harder." };
  }
  return { score: 80, title: "Well rested", hint: "It’s been a few days — ease back in." };
}

const TRIAL_LENGTH_DAYS = 14;

// Returns null when there's no trial to report (not signed in / no start date yet).
function trialDaysRemaining(trialStartedAt: string | null): number | null {
  if (!trialStartedAt) return null;
  const startMs = new Date(trialStartedAt).getTime();
  if (!Number.isFinite(startMs)) return null;
  const elapsedDays = Math.floor((Date.now() - startMs) / (24 * 60 * 60 * 1000));
  return Math.max(0, TRIAL_LENGTH_DAYS - elapsedDays);
}

function trialEndDateLabel(trialStartedAt: string | null): string | null {
  if (!trialStartedAt) return null;
  const startMs = new Date(trialStartedAt).getTime();
  if (!Number.isFinite(startMs)) return null;
  const endDate = new Date(startMs + TRIAL_LENGTH_DAYS * 24 * 60 * 60 * 1000);
  return endDate.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

// A compact plain-text summary of the user's training history, sent to the
// AI Coach so its replies can reference real progress instead of starting
// fresh every conversation.
function summarizeCoachMemory(
  workoutHistory: WorkoutHistoryEntry[],
  exerciseProgress: Record<string, ExerciseProgress>,
): string {
  if (workoutHistory.length === 0) return "No workouts logged yet.";

  const total = workoutHistory.length;
  const thisWeek = workoutHistory.filter((entry) => isWithinLastDays(entry.date, 7)).length;
  const last = workoutHistory[0];
  const lastLine = last
    ? `Last session: ${formatHistoryDate(last.date)}, ${last.exercises} exercises, ${last.sets} sets, ${formatHistoryDuration(last.seconds)}, ~${last.calories} kcal.`
    : "";
  const totalVolumeKg = workoutHistory.reduce(
    (sum, entry) =>
      sum +
      (entry.exerciseBreakdown ?? []).reduce(
        (exerciseSum, item) => exerciseSum + (item.weightKg ?? 0) * item.reps * item.sets,
        0,
      ),
    0,
  );
  const volumeLine =
    totalVolumeKg > 0
      ? `Total weight lifted to date: ~${Math.round(totalVolumeKg).toLocaleString()} kg across ${total} sessions.`
      : "";
  const progressEntries = Object.entries(exerciseProgress).slice(0, 8);
  const progressLine = progressEntries.length
    ? `Current working weights: ${progressEntries
        .map(([name, entry]) => `${name} ${entry.weightKg}kg x${entry.reps}`)
        .join(", ")}.`
    : "";

  return [`Total workouts logged: ${total} (${thisWeek} this week).`, lastLine, volumeLine, progressLine]
    .filter(Boolean)
    .join(" ");
}

type NutritionItem = NutritionTotals & {
  name: string;
  grams: number;
};

type NutritionResult = {
  items: NutritionItem[];
  totals: NutritionTotals;
  confidence: "low" | "medium" | "high";
  note: string;
};

type RecipeIngredient = {
  name: string;
  metric: string;
  imperial: string;
};

// The US (and a couple of small holdouts) cook in cups/oz/lb; the rest of the
// world uses metric. Detected once from the device/browser locale's region.
function detectUnitSystem(): "metric" | "imperial" {
  try {
    const locale =
      (Platform.OS === "web" && typeof navigator !== "undefined" && navigator.language) ||
      Intl.DateTimeFormat().resolvedOptions().locale ||
      "en-US";
    const region = locale.split(/[-_]/)[1]?.toUpperCase();
    return region === "US" || region === "LR" || region === "MM" ? "imperial" : "metric";
  } catch {
    return "metric";
  }
}

const unitSystem = detectUnitSystem();

function formatIngredient(ingredient: RecipeIngredient): string {
  const amount = unitSystem === "imperial" ? ingredient.imperial : ingredient.metric;
  return `${amount} ${ingredient.name}`;
}

type Recipe = NutritionTotals & {
  name: string;
  description: string;
  minutes: number;
  ingredients: string[];
};

const fallbackProteinRecipes: Recipe[] = [
  {
    name: "Greek Yogurt Protein Bowl",
    description: "A quick no-cook bowl with yogurt, berries, and nuts.",
    minutes: 5,
    ingredients: [
      formatIngredient({ name: "Greek yogurt", metric: "200 g", imperial: "3/4 cup" }),
      formatIngredient({ name: "Mixed berries", metric: "100 g", imperial: "2/3 cup" }),
      formatIngredient({ name: "Almonds", metric: "20 g", imperial: "2 tbsp" }),
      formatIngredient({ name: "Honey", metric: "15 g", imperial: "1 tbsp" }),
    ],
    calories: 320,
    protein: 28,
    carbs: 26,
    fat: 12,
  },
  {
    name: "Grilled Chicken and Quinoa",
    description: "Grilled chicken breast over quinoa with roasted vegetables.",
    minutes: 25,
    ingredients: [
      formatIngredient({ name: "Chicken breast", metric: "180 g", imperial: "6 oz" }),
      formatIngredient({ name: "Quinoa", metric: "60 g", imperial: "1/3 cup" }),
      formatIngredient({ name: "Broccoli", metric: "100 g", imperial: "1 cup" }),
      formatIngredient({ name: "Olive oil", metric: "10 ml", imperial: "2 tsp" }),
      formatIngredient({ name: "Lemon", metric: "1/2 lemon", imperial: "1/2 lemon" }),
    ],
    calories: 480,
    protein: 42,
    carbs: 38,
    fat: 16,
  },
  {
    name: "Tofu and Vegetable Stir-Fry",
    description: "Pan-seared tofu with mixed vegetables in a light soy glaze.",
    minutes: 20,
    ingredients: [
      formatIngredient({ name: "Firm tofu", metric: "150 g", imperial: "5 oz" }),
      formatIngredient({ name: "Bell peppers", metric: "80 g", imperial: "2/3 cup" }),
      formatIngredient({ name: "Broccoli", metric: "80 g", imperial: "3/4 cup" }),
      formatIngredient({ name: "Soy sauce", metric: "15 ml", imperial: "1 tbsp" }),
      formatIngredient({ name: "Garlic", metric: "2 cloves", imperial: "2 cloves" }),
      formatIngredient({ name: "Rice", metric: "150 g", imperial: "3/4 cup" }),
    ],
    calories: 410,
    protein: 26,
    carbs: 44,
    fat: 14,
  },
];

type DietPlanMeal = NutritionTotals & {
  time: string;
  name: string;
  description: string;
};

type DietPlanResult = {
  meals: DietPlanMeal[];
  note: string;
};

const fallbackDietPlan: DietPlanResult = {
  meals: [
    {
      time: "Breakfast",
      name: "Greek Yogurt Berry Bowl",
      description: "Greek yogurt with mixed berries, a spoon of honey, and a handful of granola.",
      calories: 380,
      protein: 28,
      carbs: 46,
      fat: 10,
    },
    {
      time: "Lunch",
      name: "Grilled Chicken and Rice Bowl",
      description: "Grilled chicken breast over rice with mixed vegetables and olive oil.",
      calories: 560,
      protein: 42,
      carbs: 58,
      fat: 16,
    },
    {
      time: "Dinner",
      name: "Baked Salmon with Vegetables",
      description: "Baked salmon with roasted vegetables and a squeeze of lemon.",
      calories: 520,
      protein: 38,
      carbs: 24,
      fat: 26,
    },
  ],
  note: "A general sample day. Adjust portions to fit your own targets and preferences.",
};

const fallbackDietWeek: DietPlanResult[] = new Array(7).fill(fallbackDietPlan);

function daysSinceDate(iso: string): number {
  const generated = new Date(iso);
  if (Number.isNaN(generated.getTime())) return 0;
  generated.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.max(0, Math.round((today.getTime() - generated.getTime()) / 86_400_000));
}

type MealCategory = "breakfast" | "lunch" | "dinner";

type LibraryRecipe = NutritionTotals & {
  id: string;
  name: string;
  category: MealCategory;
  photo: number;
  minutes: number;
  ingredients: RecipeIngredient[];
  steps: string[];
};

const recipeLibrary: LibraryRecipe[] = [
  {
    id: "greek-yogurt-parfait",
    name: "Greek Yogurt Berry Parfait",
    category: "breakfast",
    photo: require("./assets/recipes/greek-yogurt-parfait.jpg"),
    minutes: 5,
    ingredients: [
      { name: "Greek yogurt", metric: "200 g", imperial: "3/4 cup" },
      { name: "Mixed berries", metric: "100 g", imperial: "2/3 cup" },
      { name: "Granola", metric: "30 g", imperial: "1/4 cup" },
      { name: "Honey", metric: "15 g", imperial: "1 tbsp" },
    ],
    steps: [
      "Layer yogurt and berries in a glass.",
      "Top with granola and a drizzle of honey.",
      "Serve chilled.",
    ],
    calories: 310,
    protein: 22,
    carbs: 38,
    fat: 8,
  },
  {
    id: "veggie-egg-scramble",
    name: "Veggie Egg Scramble",
    category: "breakfast",
    photo: require("./assets/recipes/veggie-egg-scramble.jpg"),
    minutes: 12,
    ingredients: [
      { name: "Eggs", metric: "3 eggs", imperial: "3 eggs" },
      { name: "Spinach", metric: "60 g", imperial: "2 cups" },
      { name: "Cherry tomatoes", metric: "80 g", imperial: "1/2 cup" },
      { name: "Feta cheese", metric: "40 g", imperial: "1/3 cup" },
      { name: "Olive oil", metric: "10 ml", imperial: "2 tsp" },
    ],
    steps: [
      "Heat olive oil in a pan.",
      "Sauté spinach and tomatoes until soft.",
      "Add beaten eggs and scramble until set.",
      "Top with crumbled feta.",
    ],
    calories: 360,
    protein: 24,
    carbs: 10,
    fat: 22,
  },
  {
    id: "banana-peanut-butter-oatmeal",
    name: "Banana Peanut Butter Oatmeal",
    category: "breakfast",
    photo: require("./assets/recipes/banana-peanut-butter-oatmeal.jpg"),
    minutes: 8,
    ingredients: [
      { name: "Rolled oats", metric: "50 g", imperial: "1/2 cup" },
      { name: "Milk", metric: "200 ml", imperial: "3/4 cup" },
      { name: "Banana", metric: "1 banana", imperial: "1 banana" },
      { name: "Peanut butter", metric: "16 g", imperial: "1 tbsp" },
      { name: "Cinnamon", metric: "1/2 tsp", imperial: "1/2 tsp" },
    ],
    steps: [
      "Cook oats with milk until creamy.",
      "Stir in sliced banana and a spoon of peanut butter.",
      "Sprinkle with cinnamon.",
    ],
    calories: 380,
    protein: 14,
    carbs: 52,
    fat: 14,
  },
  {
    id: "avocado-toast-eggs",
    name: "Avocado Toast with Eggs",
    category: "breakfast",
    photo: require("./assets/recipes/avocado-toast-eggs.jpg"),
    minutes: 10,
    ingredients: [
      { name: "Whole-grain bread", metric: "2 slices", imperial: "2 slices" },
      { name: "Avocado", metric: "1/2 avocado", imperial: "1/2 avocado" },
      { name: "Eggs", metric: "2 eggs", imperial: "2 eggs" },
      { name: "Lemon juice", metric: "5 ml", imperial: "1 tsp" },
      { name: "Chili flakes", metric: "1/4 tsp", imperial: "1/4 tsp" },
    ],
    steps: [
      "Toast the bread.",
      "Mash avocado with lemon juice and spread on toast.",
      "Top with a fried or poached egg and chili flakes.",
    ],
    calories: 340,
    protein: 16,
    carbs: 28,
    fat: 20,
  },
  {
    id: "grilled-chicken-salad",
    name: "Grilled Chicken Salad",
    category: "lunch",
    photo: require("./assets/recipes/grilled-chicken-salad.jpg"),
    minutes: 20,
    ingredients: [
      { name: "Chicken breast", metric: "150 g", imperial: "5 oz" },
      { name: "Mixed greens", metric: "80 g", imperial: "3 cups" },
      { name: "Cherry tomatoes", metric: "70 g", imperial: "1/2 cup" },
      { name: "Cucumber", metric: "60 g", imperial: "1/2 cup" },
      { name: "Olive oil", metric: "10 ml", imperial: "2 tsp" },
      { name: "Balsamic vinegar", metric: "10 ml", imperial: "2 tsp" },
    ],
    steps: [
      "Grill the chicken and slice.",
      "Toss greens, tomatoes, and cucumber with olive oil and vinegar.",
      "Top with sliced chicken.",
    ],
    calories: 420,
    protein: 38,
    carbs: 16,
    fat: 20,
  },
  {
    id: "quinoa-chickpea-bowl",
    name: "Quinoa Chickpea Bowl",
    category: "lunch",
    photo: require("./assets/recipes/quinoa-chickpea-bowl.jpg"),
    minutes: 20,
    ingredients: [
      { name: "Quinoa", metric: "60 g", imperial: "1/3 cup" },
      { name: "Chickpeas", metric: "120 g", imperial: "3/4 cup" },
      { name: "Cucumber", metric: "60 g", imperial: "1/2 cup" },
      { name: "Bell pepper", metric: "70 g", imperial: "1/2 cup" },
      { name: "Tahini", metric: "15 g", imperial: "1 tbsp" },
      { name: "Lemon juice", metric: "10 ml", imperial: "2 tsp" },
    ],
    steps: [
      "Cook quinoa and let cool slightly.",
      "Toss with chickpeas, cucumber, and bell pepper.",
      "Drizzle with tahini and lemon juice.",
    ],
    calories: 430,
    protein: 18,
    carbs: 58,
    fat: 14,
  },
  {
    id: "turkey-hummus-wrap",
    name: "Turkey and Hummus Wrap",
    category: "lunch",
    photo: require("./assets/recipes/turkey-hummus-wrap.jpg"),
    minutes: 10,
    ingredients: [
      { name: "Whole-wheat wrap", metric: "1 large wrap", imperial: "1 large wrap" },
      { name: "Turkey breast", metric: "100 g", imperial: "3.5 oz" },
      { name: "Hummus", metric: "40 g", imperial: "3 tbsp" },
      { name: "Spinach", metric: "20 g", imperial: "1/2 cup" },
      { name: "Shredded carrot", metric: "30 g", imperial: "1/4 cup" },
    ],
    steps: [
      "Spread hummus over the wrap.",
      "Layer turkey, spinach, and carrot.",
      "Roll tightly and slice in half.",
    ],
    calories: 400,
    protein: 30,
    carbs: 36,
    fat: 14,
  },
  {
    id: "salmon-rice-bowl",
    name: "Salmon and Rice Bowl",
    category: "lunch",
    photo: require("./assets/recipes/salmon-rice-bowl.jpg"),
    minutes: 25,
    ingredients: [
      { name: "Salmon fillet", metric: "150 g", imperial: "5 oz" },
      { name: "Cooked rice", metric: "150 g", imperial: "3/4 cup" },
      { name: "Edamame", metric: "60 g", imperial: "1/2 cup" },
      { name: "Cucumber", metric: "50 g", imperial: "1/3 cup" },
      { name: "Soy sauce", metric: "10 ml", imperial: "2 tsp" },
      { name: "Sesame seeds", metric: "1 tsp", imperial: "1 tsp" },
    ],
    steps: [
      "Pan-sear the salmon until cooked through.",
      "Serve over rice with edamame and cucumber.",
      "Drizzle with soy sauce and sesame seeds.",
    ],
    calories: 480,
    protein: 34,
    carbs: 46,
    fat: 18,
  },
  {
    id: "baked-salmon-vegetables",
    name: "Baked Salmon with Vegetables",
    category: "dinner",
    photo: require("./assets/recipes/baked-salmon-vegetables.jpg"),
    minutes: 30,
    ingredients: [
      { name: "Salmon fillet", metric: "180 g", imperial: "6 oz" },
      { name: "Broccoli", metric: "100 g", imperial: "1 cup" },
      { name: "Carrots", metric: "80 g", imperial: "2/3 cup" },
      { name: "Olive oil", metric: "10 ml", imperial: "2 tsp" },
      { name: "Garlic", metric: "2 cloves", imperial: "2 cloves" },
      { name: "Lemon", metric: "1/2 lemon", imperial: "1/2 lemon" },
    ],
    steps: [
      "Toss vegetables with olive oil and garlic on a tray.",
      "Place salmon alongside.",
      "Bake until the salmon flakes easily.",
      "Finish with a squeeze of lemon.",
    ],
    calories: 460,
    protein: 36,
    carbs: 20,
    fat: 24,
  },
  {
    id: "grilled-chicken-sweet-potato",
    name: "Grilled Chicken with Sweet Potato",
    category: "dinner",
    photo: require("./assets/recipes/grilled-chicken-sweet-potato.jpg"),
    minutes: 35,
    ingredients: [
      { name: "Chicken breast", metric: "180 g", imperial: "6 oz" },
      { name: "Sweet potato", metric: "200 g", imperial: "1 medium" },
      { name: "Green beans", metric: "100 g", imperial: "1 cup" },
      { name: "Olive oil", metric: "10 ml", imperial: "2 tsp" },
      { name: "Paprika", metric: "1/2 tsp", imperial: "1/2 tsp" },
    ],
    steps: [
      "Season chicken with paprika and grill until cooked through.",
      "Roast sweet potato wedges and steam green beans.",
      "Serve together.",
    ],
    calories: 470,
    protein: 40,
    carbs: 42,
    fat: 14,
  },
  {
    id: "beef-vegetable-stir-fry",
    name: "Beef and Vegetable Stir-Fry",
    category: "dinner",
    photo: require("./assets/recipes/beef-vegetable-stir-fry.jpg"),
    minutes: 20,
    ingredients: [
      { name: "Beef strips", metric: "150 g", imperial: "5 oz" },
      { name: "Broccoli", metric: "80 g", imperial: "3/4 cup" },
      { name: "Bell pepper", metric: "70 g", imperial: "1/2 cup" },
      { name: "Carrot", metric: "50 g", imperial: "1/3 cup" },
      { name: "Soy sauce", metric: "15 ml", imperial: "1 tbsp" },
      { name: "Garlic", metric: "2 cloves", imperial: "2 cloves" },
      { name: "Ginger", metric: "1 tsp grated", imperial: "1 tsp grated" },
    ],
    steps: [
      "Stir-fry beef in a hot pan until browned.",
      "Add vegetables, garlic, and ginger.",
      "Stir in soy sauce and cook until vegetables are tender-crisp.",
    ],
    calories: 480,
    protein: 32,
    carbs: 34,
    fat: 22,
  },
  {
    id: "tofu-vegetable-curry",
    name: "Vegetable and Tofu Curry",
    category: "dinner",
    photo: require("./assets/recipes/tofu-vegetable-curry.jpg"),
    minutes: 30,
    ingredients: [
      { name: "Firm tofu", metric: "150 g", imperial: "5 oz" },
      { name: "Coconut milk", metric: "150 ml", imperial: "2/3 cup" },
      { name: "Curry paste", metric: "15 g", imperial: "1 tbsp" },
      { name: "Mixed vegetables", metric: "150 g", imperial: "1 1/2 cups" },
      { name: "Rice", metric: "150 g", imperial: "3/4 cup" },
    ],
    steps: [
      "Pan-sear tofu until golden.",
      "Simmer curry paste with coconut milk.",
      "Add vegetables and tofu, simmer until tender.",
      "Serve over rice.",
    ],
    calories: 420,
    protein: 20,
    carbs: 38,
    fat: 20,
  },
];

async function resizeFoodImage(file: any): Promise<string> {
  const rawData = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(file);
  });

  return new Promise<string>((resolve, reject) => {
    const imageElement = document.createElement("img");
    imageElement.onload = () => {
      const maxSide = 1280;
      const scale = Math.min(1, maxSide / Math.max(imageElement.width, imageElement.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(imageElement.width * scale));
      canvas.height = Math.max(1, Math.round(imageElement.height * scale));
      const context = canvas.getContext("2d");
      if (!context) {
        reject(new Error("The image could not be prepared."));
        return;
      }
      context.drawImage(imageElement, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.78));
    };
    imageElement.onerror = () => reject(new Error("The image could not be opened."));
    imageElement.src = rawData;
  });
}

function sumNutrition(items: NutritionItem[]): NutritionTotals {
  return items.reduce(
    (total, item) => ({
      calories: total.calories + item.calories,
      protein: total.protein + item.protein,
      carbs: total.carbs + item.carbs,
      fat: total.fat + item.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

const DIET_MODE_OPTIONS: { value: DietMode; label: string }[] = [
  { value: "bulk", label: "BULK" },
  { value: "cut", label: "CUT" },
  { value: "recomp", label: "RECOMP" },
];

const DIET_MODE_HINT: Record<DietMode, string> = {
  bulk: "Calorie surplus to build muscle.",
  cut: "Calorie deficit, higher protein to keep muscle.",
  recomp: "Maintenance calories, high protein to build while leaning out.",
};

function NutritionScreen({
  onBack,
  onSave,
  onOpenRecipes,
  onOpenRecipeLibrary,
  onOpenDietPlan,
  onStartWorkout,
  onOpenProgress,
  onOpenCoach,
  profile,
  nutritionTotals,
  onUpdateProfile,
}: {
  onBack: () => void;
  onSave: (totals: NutritionTotals) => void;
  onOpenRecipes: () => void;
  onOpenRecipeLibrary: () => void;
  onOpenDietPlan: () => void;
  onStartWorkout: () => void;
  onOpenProgress: () => void;
  onOpenCoach: () => void;
  profile: Record<string, string>;
  nutritionTotals: NutritionTotals;
  onUpdateProfile: (id: string, value: string) => void;
}) {
  const dietMode = inferDietMode(profile);
  const proteinTarget = dailyProteinTargetGrams(profile);
  const proteinRemaining = Math.max(0, proteinTarget - nutritionTotals.protein);
  const [imageData, setImageData] = useState("");
  const [result, setResult] = useState<NutritionResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [refineDraft, setRefineDraft] = useState("");
  const [refineMessages, setRefineMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [isRefining, setIsRefining] = useState(false);

  const choosePhoto = async (event: any) => {
    const file = event?.target?.files?.[0];
    if (!file) return;
    setError("");
    setResult(null);
    setSaved(false);
    setRefineMessages([]);
    try {
      setImageData(await resizeFoodImage(file));
    } catch {
      setError("This photo could not be prepared. Please choose another one.");
    }
  };

  const analyzeMeal = async () => {
    if (!imageData || isAnalyzing) return;
    setIsAnalyzing(true);
    setError("");
    setSaved(false);
    setRefineMessages([]);
    try {
      const response = await fetch("/api/nutrition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageData }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Analysis failed");
      setResult(data as NutritionResult);
    } catch {
      setError("The meal could not be analyzed. Check your connection and try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const sendRefinement = async () => {
    const message = refineDraft.trim();
    if (!message || !result || isRefining) return;
    setRefineDraft("");
    setRefineMessages((prev) => [...prev, { role: "user", text: message }]);
    setIsRefining(true);
    try {
      const response = await fetch("/api/nutrition", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: imageData, correction: message, previousResult: result }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "Refinement failed");
      setResult(data as NutritionResult);
      setSaved(false);
      setRefineMessages((prev) => [...prev, { role: "ai", text: "Updated the analysis based on your note." }]);
    } catch {
      setRefineMessages((prev) => [...prev, { role: "ai", text: "Could not update the analysis. Please try again." }]);
    } finally {
      setIsRefining(false);
    }
  };

  const adjustGrams = (index: number, delta: number) => {
    if (!result) return;
    const items = result.items.map((item, itemIndex) => {
      if (itemIndex !== index) return item;
      const nextGrams = Math.max(10, item.grams + delta);
      const ratio = nextGrams / Math.max(1, item.grams);
      return {
        ...item,
        grams: nextGrams,
        calories: Math.round(item.calories * ratio),
        protein: Math.round(item.protein * ratio),
        carbs: Math.round(item.carbs * ratio),
        fat: Math.round(item.fat * ratio),
      };
    });
    setResult({ ...result, items, totals: sumNutrition(items) });
    setSaved(false);
  };

  return (
    <SafeAreaView style={styles.nutritionScreen}>
      <View style={styles.nutritionHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.coachBack}>
          <Text style={styles.coachBackText}>‹</Text>
        </Pressable>
        <View>
          <Text style={styles.nutritionHeaderTitle}>NUTRITION</Text>
          <Text style={styles.nutritionHeaderSubtitle}>AI meal analysis</Text>
        </View>
        <View style={styles.coachHeaderSpacer} />
      </View>

      <ScrollView
        style={styles.nutritionScroll}
        contentContainerStyle={styles.nutritionContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.nutritionIntro}>
          <Text style={styles.nutritionEyebrow}>SCAN YOUR MEAL</Text>
          <Text style={styles.nutritionTitle}>Know what is on your plate.</Text>
          <Text style={styles.nutritionSubtitle}>
            Take a clear overhead photo. You can correct every portion before saving.
          </Text>
        </View>

        <View style={styles.dietModeRow}>
          {DIET_MODE_OPTIONS.map((option) => (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityLabel={`Switch to ${option.label.toLowerCase()} mode`}
              onPress={() => onUpdateProfile("dietMode", option.value)}
              style={[styles.dietModePill, dietMode === option.value && styles.dietModePillActive]}
            >
              <Text
                style={[styles.dietModePillText, dietMode === option.value && styles.dietModePillTextActive]}
              >
                {option.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.dietModeHint}>{DIET_MODE_HINT[dietMode]}</Text>

        <View style={styles.foodPhotoCard}>
          {imageData ? (
            <Image source={{ uri: imageData }} resizeMode="cover" style={styles.foodPhoto} />
          ) : (
            <View style={styles.foodPhotoEmpty}>
              <Text style={styles.foodPhotoIcon}>+</Text>
              <Text style={styles.foodPhotoEmptyTitle}>ADD A FOOD PHOTO</Text>
              <Text style={styles.foodPhotoEmptyText}>Camera or photo library</Text>
            </View>
          )}
          {Platform.OS === "web"
            ? createElement("input", {
                type: "file",
                accept: "image/*",
                "aria-label": "Choose food photo",
                onChange: choosePhoto,
                style: {
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  opacity: 0,
                  cursor: "pointer",
                },
              })
            : null}
        </View>

        {imageData ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Analyze meal with AI"
            onPress={analyzeMeal}
            disabled={isAnalyzing}
            style={styles.nutritionAnalyzeButton}
          >
            <Text style={styles.nutritionAnalyzeButtonText}>
              {isAnalyzing ? "ANALYZING MEAL..." : result ? "ANALYZE AGAIN" : "ANALYZE WITH AI"}
            </Text>
            <Text style={styles.nutritionAnalyzeArrow}>{"->"}</Text>
          </Pressable>
        ) : null}

        {error ? <Text style={styles.nutritionError}>{error}</Text> : null}

        {result ? (
          <View style={styles.nutritionResults}>
            <View style={styles.nutritionResultHeader}>
              <Text style={styles.nutritionResultTitle}>AI ANALYSIS</Text>
              <Text style={styles.nutritionConfidence}>{result.confidence.toUpperCase()} CONFIDENCE</Text>
            </View>

            {result.items.map((item, index) => (
              <View key={`${item.name}-${index}`} style={styles.foodItemRow}>
                <View style={styles.foodItemCopy}>
                  <Text style={styles.foodItemName}>{item.name}</Text>
                  <Text style={styles.foodItemMacros}>
                    {item.calories} kcal | P {item.protein}g | C {item.carbs}g | F {item.fat}g
                  </Text>
                </View>
                <View style={styles.portionControl}>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Reduce ${item.name} portion`}
                    onPress={() => adjustGrams(index, -10)}
                    style={styles.portionButton}
                  >
                    <Text style={styles.portionButtonText}>-</Text>
                  </Pressable>
                  <Text style={styles.portionValue}>{item.grams}g</Text>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Increase ${item.name} portion`}
                    onPress={() => adjustGrams(index, 10)}
                    style={styles.portionButton}
                  >
                    <Text style={styles.portionButtonText}>+</Text>
                  </Pressable>
                </View>
              </View>
            ))}

            <View style={styles.nutritionTotalCard}>
              <Text style={styles.nutritionTotalLabel}>MEAL TOTAL</Text>
              <Text style={styles.nutritionCalories}>{result.totals.calories} kcal</Text>
              <View style={styles.nutritionMacroRow}>
                {[
                  ["PROTEIN", `${result.totals.protein}g`],
                  ["CARBS", `${result.totals.carbs}g`],
                  ["FAT", `${result.totals.fat}g`],
                ].map(([label, value]) => (
                  <View key={label} style={styles.nutritionMacro}>
                    <Text style={styles.nutritionMacroValue}>{value}</Text>
                    <Text style={styles.nutritionMacroLabel}>{label}</Text>
                  </View>
                ))}
              </View>
            </View>

            <Text style={styles.nutritionNote}>Estimate only. {result.note}</Text>

            <View style={styles.nutritionRefineSection}>
              <Text style={styles.nutritionRefineLabel}>NOT QUITE RIGHT?</Text>
              {refineMessages.map((msg, index) =>
                msg.role === "user" ? (
                  <View key={index} style={styles.userBubble}>
                    <Text style={styles.userBubbleText}>{msg.text}</Text>
                  </View>
                ) : (
                  <View key={index} style={styles.coachBubbleRow}>
                    <View style={styles.coachBubbleMark}>
                      <Text style={styles.coachBubbleMarkText}>G</Text>
                    </View>
                    <View style={styles.coachBubble}>
                      <Text style={styles.coachBubbleText}>{msg.text}</Text>
                    </View>
                  </View>
                ),
              )}
              {isRefining ? (
                <View style={styles.coachBubbleRow}>
                  <View style={styles.coachBubbleMark}>
                    <Text style={styles.coachBubbleMarkText}>G</Text>
                  </View>
                  <View style={styles.coachBubble}>
                    <Text style={styles.coachBubbleText}>Updating the analysis…</Text>
                  </View>
                </View>
              ) : null}
              <View style={styles.nutritionRefineComposer}>
                <TextInput
                  accessibilityLabel="Tell the AI what's different about this meal"
                  value={refineDraft}
                  onChangeText={setRefineDraft}
                  onSubmitEditing={sendRefinement}
                  placeholder="e.g. it's bulgur, not rice..."
                  placeholderTextColor="#747A72"
                  returnKeyType="send"
                  style={styles.coachInput}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Send correction"
                  onPress={sendRefinement}
                  disabled={!refineDraft.trim() || isRefining}
                  style={[styles.coachSend, (!refineDraft.trim() || isRefining) && styles.coachSendDisabled]}
                >
                  <Text style={styles.coachSendText}>↑</Text>
                </Pressable>
              </View>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save meal"
              onPress={() => {
                onSave(result.totals);
                setSaved(true);
              }}
              disabled={saved}
              style={[styles.nutritionSaveButton, saved && styles.nutritionSaveButtonDone]}
            >
              <Text style={styles.nutritionSaveButtonText}>{saved ? "MEAL SAVED" : "SAVE MEAL"}</Text>
            </Pressable>
          </View>
        ) : null}

        {proteinRemaining > 5 ? (
          <View style={styles.proteinGapCard}>
            <View style={styles.proteinGapCopy}>
              <Text style={styles.proteinGapEyebrow}>TODAY’S PROTEIN GAP</Text>
              <Text style={styles.proteinGapTitle}>You need {proteinRemaining}g more protein today.</Text>
              <Text style={styles.proteinGapSubtitle}>Estimate only, based on your goal and body weight.</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="See recipe suggestions"
              onPress={onOpenRecipes}
              style={styles.proteinGapButton}
            >
              <Text style={styles.proteinGapButtonText}>SEE RECIPES</Text>
              <Text style={styles.proteinGapButtonArrow}>→</Text>
            </Pressable>
          </View>
        ) : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Browse recipe library"
          onPress={onOpenRecipeLibrary}
          style={styles.libraryEntryCard}
        >
          <View style={styles.libraryEntryIcon}>
            <Text style={styles.libraryEntryIconText}>🍽️</Text>
          </View>
          <View style={styles.libraryEntryCopy}>
            <Text style={styles.libraryEntryEyebrow}>BREAKFAST · LUNCH · DINNER</Text>
            <Text style={styles.libraryEntryTitle}>Browse the recipe library</Text>
            <Text style={styles.libraryEntrySubtitle}>12 meals with macros, ready to cook</Text>
          </View>
          <View style={styles.libraryEntryArrow}>
            <Text style={styles.libraryEntryArrowText}>→</Text>
          </View>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Build an AI diet plan"
          onPress={onOpenDietPlan}
          style={styles.libraryEntryCard}
        >
          <View style={styles.libraryEntryIcon}>
            <Text style={styles.libraryEntryIconText}>🧠</Text>
          </View>
          <View style={styles.libraryEntryCopy}>
            <Text style={styles.libraryEntryEyebrow}>AI + COACH</Text>
            <Text style={styles.libraryEntryTitle}>Build a diet plan</Text>
            <Text style={styles.libraryEntrySubtitle}>A few quick questions, then a sample day</Text>
          </View>
          <View style={styles.libraryEntryArrow}>
            <Text style={styles.libraryEntryArrowText}>→</Text>
          </View>
        </Pressable>
      </ScrollView>

      <BottomNav
        active="nutrition"
        onHome={onBack}
        onNutrition={() => {}}
        onProgress={onOpenProgress}
        onCoach={onOpenCoach}
      />
    </SafeAreaView>
  );
}

function RecipesScreen({
  onBack,
  profile,
  nutritionTotals,
}: {
  onBack: () => void;
  profile: Record<string, string>;
  nutritionTotals: NutritionTotals;
}) {
  const proteinRemaining = Math.max(0, dailyProteinTargetGrams(profile) - nutritionTotals.protein);
  const [recipes, setRecipes] = useState<Recipe[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFallback, setIsFallback] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadRecipes = async () => {
      setIsLoading(true);
      try {
        const response = await fetch("/api/recipes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            proteinRemaining,
            profile: { goal: profile.goal, sex: profile.sex, equipment: profile.equipment },
            unitSystem,
          }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data?.error ?? "Recipe request failed");
        if (!cancelled) {
          setRecipes(data.recipes as Recipe[]);
          setIsFallback(false);
        }
      } catch {
        if (!cancelled) {
          setRecipes(fallbackProteinRecipes);
          setIsFallback(true);
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void loadRecipes();
    return () => {
      cancelled = true;
    };
  }, [proteinRemaining, profile.goal, profile.sex, profile.equipment]);

  return (
    <SafeAreaView style={styles.recipesScreen}>
      <View style={styles.nutritionHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.coachBack}>
          <Text style={styles.coachBackText}>‹</Text>
        </Pressable>
        <View>
          <Text style={styles.nutritionHeaderTitle}>RECIPES</Text>
          <Text style={styles.nutritionHeaderSubtitle}>Close today’s protein gap</Text>
        </View>
        <View style={styles.coachHeaderSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.nutritionContent} showsVerticalScrollIndicator={false}>
        <View style={styles.nutritionIntro}>
          <Text style={styles.nutritionEyebrow}>~{proteinRemaining}G PROTEIN NEEDED</Text>
          <Text style={styles.nutritionTitle}>A few ideas for today.</Text>
          <Text style={styles.nutritionSubtitle}>
            General food inspiration, not medical or nutritional advice.
          </Text>
        </View>

        {isLoading ? (
          <View style={styles.recipeLoading}>
            <Text style={styles.recipeLoadingText}>Finding recipes for you…</Text>
          </View>
        ) : (
          <>
            {isFallback ? (
              <Text style={styles.nutritionError}>Live suggestions are unavailable. Showing saved ideas instead.</Text>
            ) : null}
            {(recipes ?? []).map((recipe) => (
              <View key={recipe.name} style={styles.recipeCard}>
                <View style={styles.recipeCardHeader}>
                  <Text style={styles.recipeName}>{recipe.name}</Text>
                  <Text style={styles.recipeMinutes}>{recipe.minutes} MIN</Text>
                </View>
                <Text style={styles.recipeDescription}>{recipe.description}</Text>
                <View style={styles.recipeIngredients}>
                  {recipe.ingredients.map((ingredient) => (
                    <View key={ingredient} style={styles.recipeIngredientPill}>
                      <Text style={styles.recipeIngredientText}>{ingredient}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.recipeMacroRow}>
                  <Text style={styles.recipeMacroText}>{recipe.calories} kcal</Text>
                  <Text style={styles.recipeMacroDivider}>·</Text>
                  <Text style={styles.recipeMacroTextHighlight}>P {recipe.protein}g</Text>
                  <Text style={styles.recipeMacroDivider}>·</Text>
                  <Text style={styles.recipeMacroText}>C {recipe.carbs}g</Text>
                  <Text style={styles.recipeMacroDivider}>·</Text>
                  <Text style={styles.recipeMacroText}>F {recipe.fat}g</Text>
                </View>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const dietaryStyleOptions = [
  { label: "No restrictions", value: "none" },
  { label: "Vegetarian", value: "vegetarian" },
  { label: "Vegan", value: "vegan" },
  { label: "Low-carb", value: "low-carb" },
];
const mealsPerDayOptions = [
  { label: "3 meals", value: "3" },
  { label: "4 meals", value: "4" },
  { label: "5 meals", value: "5" },
];
const prepTimeOptions = [
  { label: "Quick (<15 min)", value: "quick" },
  { label: "Moderate", value: "moderate" },
  { label: "No limit", value: "any" },
];

type SavedDietPlan = {
  dietaryStyle: string;
  mealsPerDay: string;
  prepTime: string;
  avoid: string;
  days: DietPlanResult[];
  generatedAt: string;
  isFallback: boolean;
};

function MealDetailModal({
  meal,
  prepTime,
  onClose,
}: {
  meal: DietPlanMeal | null;
  prepTime: string;
  onClose: () => void;
}) {
  const detailCacheRef = useRef<Record<string, { ingredients: RecipeIngredient[]; steps: string[] }>>({});
  const imageCacheRef = useRef<Record<string, string>>({});
  const [detail, setDetail] = useState<{ ingredients: RecipeIngredient[]; steps: string[] } | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState(false);

  useEffect(() => {
    if (!meal) return;
    setDetailError("");

    const cachedDetail = detailCacheRef.current[meal.name];
    if (cachedDetail) {
      setDetail(cachedDetail);
    } else {
      setDetail(null);
      setIsLoadingDetail(true);
      void (async () => {
        try {
          const response = await fetch("/api/meal-detail", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: meal.name,
              description: meal.description,
              calories: meal.calories,
              protein: meal.protein,
              carbs: meal.carbs,
              fat: meal.fat,
              unitSystem,
              prepTime,
            }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data?.error ?? "Detail request failed");
          const result = { ingredients: data.ingredients as RecipeIngredient[], steps: data.steps as string[] };
          detailCacheRef.current[meal.name] = result;
          setDetail(result);
        } catch {
          setDetailError("Could not load the full recipe right now. Try again.");
        } finally {
          setIsLoadingDetail(false);
        }
      })();
    }

    const cachedImage = imageCacheRef.current[meal.name];
    if (cachedImage) {
      setImageUrl(cachedImage);
    } else {
      setImageUrl(null);
      setIsLoadingImage(true);
      void (async () => {
        try {
          const response = await fetch("/api/meal-image", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: meal.name, description: meal.description }),
          });
          const data = await response.json();
          if (!response.ok || !data.image) throw new Error("Image request failed");
          imageCacheRef.current[meal.name] = data.image as string;
          setImageUrl(data.image as string);
        } catch {
          // No photo is an acceptable degraded state; the recipe still works without it.
        } finally {
          setIsLoadingImage(false);
        }
      })();
    }
  }, [meal, prepTime]);

  if (!meal) return null;

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.recipesScreen}>
        <View style={styles.nutritionHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} style={styles.coachBack}>
            <Text style={styles.coachBackText}>‹</Text>
          </Pressable>
          <View>
            <Text style={styles.nutritionHeaderTitle}>{meal.time.toUpperCase()}</Text>
            <Text style={styles.nutritionHeaderSubtitle}>Full recipe</Text>
          </View>
          <View style={styles.coachHeaderSpacer} />
        </View>

        <ScrollView contentContainerStyle={styles.recipeDetailContent} showsVerticalScrollIndicator={false}>
          {imageUrl ? (
            <Image source={{ uri: imageUrl }} style={styles.recipeDetailPhoto} resizeMode="cover" />
          ) : (
            <View style={[styles.recipeDetailPhoto, styles.mealImagePlaceholder]}>
              {isLoadingImage ? (
                <Text style={styles.mealImagePlaceholderText}>GENERATING PHOTO…</Text>
              ) : (
                <Text style={styles.mealImagePlaceholderIcon}>🍽️</Text>
              )}
            </View>
          )}

          <View style={styles.recipeDetailBody}>
            <Text style={styles.recipeDetailName}>{meal.name}</Text>

            <View style={styles.nutritionFactsBar}>
              {[
                ["🔥", meal.calories, "KCAL"],
                ["💪", `${meal.protein}g`, "PROTEIN"],
                ["🌾", `${meal.carbs}g`, "CARBS"],
                ["💧", `${meal.fat}g`, "FAT"],
              ].map(([icon, value, label], index) => (
                <View key={label} style={styles.nutritionFactsRow}>
                  <View style={styles.nutritionFactsItem}>
                    <Text style={styles.nutritionFactsIcon}>{icon}</Text>
                    <Text style={styles.nutritionFactsValue}>{value}</Text>
                    <Text style={styles.nutritionFactsLabel}>{label}</Text>
                  </View>
                  {index < 3 ? <View style={styles.nutritionFactsDivider} /> : null}
                </View>
              ))}
            </View>

            {isLoadingDetail ? (
              <Text style={styles.nutritionSubtitle}>Building the full recipe…</Text>
            ) : detailError ? (
              <Text style={styles.nutritionError}>{detailError}</Text>
            ) : detail ? (
              <>
                <Text style={styles.recipeSectionTitle}>INGREDIENTS</Text>
                <View style={styles.recipeIngredients}>
                  {detail.ingredients.map((ingredient) => (
                    <View key={ingredient.name} style={styles.recipeIngredientPill}>
                      <Text style={styles.recipeIngredientText}>{formatIngredient(ingredient)}</Text>
                    </View>
                  ))}
                </View>

                <Text style={styles.recipeSectionTitle}>STEPS</Text>
                {detail.steps.map((step, index) => (
                  <View key={index} style={styles.recipeStepRow}>
                    <Text style={styles.recipeStepNumber}>{index + 1}</Text>
                    <Text style={styles.recipeStepText}>{step}</Text>
                  </View>
                ))}
              </>
            ) : null}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function DietPlanScreen({
  onBack,
  profile,
  savedPlan,
  onSave,
}: {
  onBack: () => void;
  profile: Record<string, string>;
  savedPlan: SavedDietPlan | null;
  onSave: (saved: SavedDietPlan) => void;
}) {
  const hasSavedWeek = Array.isArray(savedPlan?.days) && savedPlan.days.length > 0;
  const [dietaryStyle, setDietaryStyle] = useState(savedPlan?.dietaryStyle ?? "none");
  const [mealsPerDay, setMealsPerDay] = useState(savedPlan?.mealsPerDay ?? "3");
  const [prepTime, setPrepTime] = useState(savedPlan?.prepTime ?? "any");
  const [avoid, setAvoid] = useState(savedPlan?.avoid ?? "");
  const [stage, setStage] = useState<"form" | "loading" | "result">(hasSavedWeek ? "result" : "form");
  const [days, setDays] = useState<DietPlanResult[]>(hasSavedWeek ? savedPlan!.days : []);
  const [generatedAt, setGeneratedAt] = useState(savedPlan?.generatedAt ?? "");
  const [isFallback, setIsFallback] = useState(savedPlan?.isFallback ?? false);
  const [selectedMeal, setSelectedMeal] = useState<DietPlanMeal | null>(null);

  const calorieTarget = dailyCalorieTargetKcal(profile);
  const proteinTarget = dailyProteinTargetGrams(profile);
  const daysSince = generatedAt ? daysSinceDate(generatedAt) : 0;
  const activeDayIndex = days.length ? daysSince % days.length : 0;
  const cycleComplete = days.length > 0 && daysSince >= days.length;

  const buildPlan = async () => {
    setStage("loading");
    try {
      const response = await fetch("/api/diet-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile: { goal: profile.goal, equipment: profile.equipment },
          dietaryStyle,
          mealsPerDay,
          prepTime,
          avoid: avoid.trim().slice(0, 140),
          calorieTarget,
          proteinTarget,
          unitSystem,
        }),
      });
      const data = (await response.json()) as { error?: string; days?: DietPlanResult[] };
      if (!response.ok || !data.days?.length) throw new Error(data?.error ?? "Diet plan request failed");
      const nowIso = new Date().toISOString();
      setDays(data.days);
      setGeneratedAt(nowIso);
      setIsFallback(false);
      onSave({ dietaryStyle, mealsPerDay, prepTime, avoid, days: data.days, generatedAt: nowIso, isFallback: false });
    } catch {
      const nowIso = new Date().toISOString();
      setDays(fallbackDietWeek);
      setGeneratedAt(nowIso);
      setIsFallback(true);
      onSave({ dietaryStyle, mealsPerDay, prepTime, avoid, days: fallbackDietWeek, generatedAt: nowIso, isFallback: true });
    } finally {
      setStage("result");
    }
  };

  const dayTotals = (day: DietPlanResult) =>
    day.meals.reduce(
      (sum, meal) => ({
        calories: sum.calories + meal.calories,
        protein: sum.protein + meal.protein,
        carbs: sum.carbs + meal.carbs,
        fat: sum.fat + meal.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 },
    );

  return (
    <SafeAreaView style={styles.recipesScreen}>
      <View style={styles.nutritionHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.coachBack}>
          <Text style={styles.coachBackText}>‹</Text>
        </Pressable>
        <View>
          <Text style={styles.nutritionHeaderTitle}>DIET PLAN</Text>
          <Text style={styles.nutritionHeaderSubtitle}>AI-built week of meals</Text>
        </View>
        <View style={styles.coachHeaderSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.nutritionContent} showsVerticalScrollIndicator={false}>
        {stage !== "result" ? (
          <>
            <View style={styles.nutritionIntro}>
              <Text style={styles.nutritionEyebrow}>BUILD YOUR PLAN</Text>
              <Text style={styles.nutritionTitle}>A few quick questions.</Text>
              <Text style={styles.nutritionSubtitle}>
                General food inspiration sized to ~{calorieTarget} kcal and {proteinTarget}g protein a day, not
                medical or dietary advice.
              </Text>
            </View>

            <Text style={styles.dietGroupLabel}>DIETARY STYLE</Text>
            <View style={styles.dietChipRow}>
              {dietaryStyleOptions.map((option) => (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: dietaryStyle === option.value }}
                  onPress={() => setDietaryStyle(option.value)}
                  style={[styles.dietChip, dietaryStyle === option.value && styles.dietChipSelected]}
                >
                  <Text style={[styles.dietChipText, dietaryStyle === option.value && styles.dietChipTextSelected]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.dietGroupLabel}>MEALS PER DAY</Text>
            <View style={styles.dietChipRow}>
              {mealsPerDayOptions.map((option) => (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: mealsPerDay === option.value }}
                  onPress={() => setMealsPerDay(option.value)}
                  style={[styles.dietChip, mealsPerDay === option.value && styles.dietChipSelected]}
                >
                  <Text style={[styles.dietChipText, mealsPerDay === option.value && styles.dietChipTextSelected]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.dietGroupLabel}>COOKING TIME</Text>
            <View style={styles.dietChipRow}>
              {prepTimeOptions.map((option) => (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: prepTime === option.value }}
                  onPress={() => setPrepTime(option.value)}
                  style={[styles.dietChip, prepTime === option.value && styles.dietChipSelected]}
                >
                  <Text style={[styles.dietChipText, prepTime === option.value && styles.dietChipTextSelected]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.dietGroupLabel}>FOODS TO AVOID (OPTIONAL)</Text>
            <TextInput
              value={avoid}
              onChangeText={setAvoid}
              placeholder="e.g. mushrooms, shellfish"
              placeholderTextColor="#5B6058"
              style={styles.dietAvoidInput}
              maxLength={140}
            />

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Build my plan"
              onPress={buildPlan}
              disabled={stage === "loading"}
              style={[styles.dietBuildButton, stage === "loading" && styles.dietBuildButtonDisabled]}
            >
              <Text style={styles.dietBuildButtonText}>
                {stage === "loading" ? "BUILDING YOUR PLAN…" : "BUILD MY PLAN"}
              </Text>
              {stage !== "loading" ? <Text style={styles.dietBuildButtonArrow}>→</Text> : null}
            </Pressable>
          </>
        ) : (
          <>
            <View style={styles.nutritionIntro}>
              <Text style={styles.nutritionEyebrow}>YOUR WEEK OF MEALS</Text>
              <Text style={styles.nutritionTitle}>7 varied days, not the same plate twice.</Text>
              <Text style={styles.nutritionSubtitle}>
                Each day below is different so you're not eating the same thing on repeat.
              </Text>
            </View>

            {isFallback ? (
              <Text style={styles.nutritionError}>
                Live plan generation is unavailable. Showing a saved sample instead.
              </Text>
            ) : null}

            {cycleComplete ? (
              <Text style={styles.dietCycleNote}>
                You've been through this week's plan — rebuild for a fresh set of days.
              </Text>
            ) : null}

            {days.map((day, dayIndex) => {
              const totals = dayTotals(day);
              const isToday = dayIndex === activeDayIndex;
              return (
                <View key={dayIndex}>
                  <View style={styles.dietDayHeader}>
                    <Text style={styles.dietDayLabel}>DAY {dayIndex + 1}</Text>
                    {isToday ? (
                      <View style={styles.dietTodayBadge}>
                        <Text style={styles.dietTodayBadgeText}>TODAY</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={styles.nutritionSubtitle}>{day.note}</Text>

                  {day.meals.map((meal) => (
                    <Pressable
                      key={meal.name}
                      accessibilityRole="button"
                      accessibilityLabel={`View full recipe for ${meal.name}`}
                      onPress={() => setSelectedMeal(meal)}
                      style={styles.recipeCard}
                    >
                      <View style={styles.recipeCardHeader}>
                        <Text style={styles.recipeName}>{meal.name}</Text>
                        <Text style={styles.recipeMinutes}>{meal.time.toUpperCase()}</Text>
                      </View>
                      <Text style={styles.recipeDescription}>{meal.description}</Text>
                      <View style={styles.recipeMacroRow}>
                        <Text style={styles.recipeMacroText}>{meal.calories} kcal</Text>
                        <Text style={styles.recipeMacroDivider}>·</Text>
                        <Text style={styles.recipeMacroTextHighlight}>P {meal.protein}g</Text>
                        <Text style={styles.recipeMacroDivider}>·</Text>
                        <Text style={styles.recipeMacroText}>C {meal.carbs}g</Text>
                        <Text style={styles.recipeMacroDivider}>·</Text>
                        <Text style={styles.recipeMacroText}>F {meal.fat}g</Text>
                      </View>
                      <Text style={styles.recipeTapHint}>TAP FOR FULL RECIPE</Text>
                    </Pressable>
                  ))}

                  <View style={styles.dietTotalsRow}>
                    <Text style={styles.dietTotalsLabel}>DAY TOTAL</Text>
                    <Text style={styles.dietTotalsValue}>
                      {totals.calories} kcal · P {totals.protein}g · C {totals.carbs}g · F {totals.fat}g
                    </Text>
                  </View>
                </View>
              );
            })}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Adjust and rebuild"
              onPress={() => setStage("form")}
              style={styles.dietRebuildButton}
            >
              <Text style={styles.dietRebuildButtonText}>ADJUST AND REBUILD</Text>
            </Pressable>
          </>
        )}
      </ScrollView>

      <MealDetailModal meal={selectedMeal} prepTime={prepTime} onClose={() => setSelectedMeal(null)} />
    </SafeAreaView>
  );
}

const mealCategoryLabels: Record<MealCategory, string> = {
  breakfast: "BREAKFAST",
  lunch: "LUNCH",
  dinner: "DINNER",
};

function RecipeLibraryScreen({
  onBack,
  onSelectRecipe,
}: {
  onBack: () => void;
  onSelectRecipe: (recipeId: string) => void;
}) {
  const [category, setCategory] = useState<MealCategory>("breakfast");
  const visibleRecipes = recipeLibrary.filter((recipe) => recipe.category === category);

  return (
    <SafeAreaView style={styles.recipesScreen}>
      <View style={styles.nutritionHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.coachBack}>
          <Text style={styles.coachBackText}>‹</Text>
        </Pressable>
        <View>
          <Text style={styles.nutritionHeaderTitle}>RECIPE LIBRARY</Text>
          <Text style={styles.nutritionHeaderSubtitle}>Browse by meal</Text>
        </View>
        <View style={styles.coachHeaderSpacer} />
      </View>

      <View style={styles.libraryTabs}>
        {(["breakfast", "lunch", "dinner"] as MealCategory[]).map((cat) => {
          const isActive = cat === category;
          return (
            <Pressable
              key={cat}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              onPress={() => setCategory(cat)}
              style={[styles.libraryTab, isActive && styles.libraryTabActive]}
            >
              <Text style={[styles.libraryTabText, isActive && styles.libraryTabTextActive]}>
                {mealCategoryLabels[cat]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={styles.nutritionContent} showsVerticalScrollIndicator={false}>
        {visibleRecipes.map((recipe) => (
          <Pressable
            key={recipe.id}
            accessibilityRole="button"
            accessibilityLabel={`Open ${recipe.name}`}
            onPress={() => onSelectRecipe(recipe.id)}
            style={styles.libraryCard}
          >
            <Image source={recipe.photo} style={styles.libraryCardPhoto} resizeMode="cover" />
            <View style={styles.libraryCardBody}>
              <Text style={styles.libraryCardName}>{recipe.name}</Text>
              <Text style={styles.libraryCardMeta}>
                {recipe.minutes} MIN · {recipe.calories} kcal · P {recipe.protein}g
              </Text>
            </View>
            <Text style={styles.cardChevron}>›</Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

function RecipeLibraryDetailScreen({
  recipe,
  onBack,
}: {
  recipe: LibraryRecipe;
  onBack: () => void;
}) {
  return (
    <SafeAreaView style={styles.recipesScreen}>
      <View style={styles.nutritionHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.coachBack}>
          <Text style={styles.coachBackText}>‹</Text>
        </Pressable>
        <View>
          <Text style={styles.nutritionHeaderTitle}>{mealCategoryLabels[recipe.category]}</Text>
          <Text style={styles.nutritionHeaderSubtitle}>{recipe.minutes} min recipe</Text>
        </View>
        <View style={styles.coachHeaderSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.recipeDetailContent} showsVerticalScrollIndicator={false}>
        <Image source={recipe.photo} style={styles.recipeDetailPhoto} resizeMode="cover" />
        <View style={styles.recipeDetailBody}>
          <Text style={styles.recipeDetailName}>{recipe.name}</Text>

          <View style={styles.nutritionFactsBar}>
            {[
              ["🔥", recipe.calories, "KCAL"],
              ["💪", `${recipe.protein}g`, "PROTEIN"],
              ["🌾", `${recipe.carbs}g`, "CARBS"],
              ["💧", `${recipe.fat}g`, "FAT"],
            ].map(([icon, value, label], index) => (
              <View key={label} style={styles.nutritionFactsRow}>
                <View style={styles.nutritionFactsItem}>
                  <Text style={styles.nutritionFactsIcon}>{icon}</Text>
                  <Text style={styles.nutritionFactsValue}>{value}</Text>
                  <Text style={styles.nutritionFactsLabel}>{label}</Text>
                </View>
                {index < 3 ? <View style={styles.nutritionFactsDivider} /> : null}
              </View>
            ))}
          </View>

          <Text style={styles.recipeSectionTitle}>INGREDIENTS</Text>
          <View style={styles.recipeIngredients}>
            {recipe.ingredients.map((ingredient) => (
              <View key={ingredient.name} style={styles.recipeIngredientPill}>
                <Text style={styles.recipeIngredientText}>{formatIngredient(ingredient)}</Text>
              </View>
            ))}
          </View>

          <Text style={styles.recipeSectionTitle}>STEPS</Text>
          {recipe.steps.map((step, index) => (
            <View key={step} style={styles.recipeStepRow}>
              <Text style={styles.recipeStepNumber}>{index + 1}</Text>
              <Text style={styles.recipeStepText}>{step}</Text>
            </View>
          ))}
        </View>
      </ScrollView>
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

type ResolvedCoachScenario = CoachScenario | "nutrition" | "general" | "off_topic";

// A full chat turn, persisted (unlike the old single-slot reply state) so the
// coach can see -- and the user can scroll back through -- the whole
// conversation, not just the latest exchange.
type CoachMessage = {
  id: string;
  role: "user" | "ai";
  text: string;
  scenario?: ResolvedCoachScenario;
  changes?: string[];
  requiresHumanReview?: boolean;
  applied?: boolean;
  reviewStatus?: "idle" | "sending" | "sent" | "error";
};

function isActionableScenario(scenario: ResolvedCoachScenario | null): scenario is CoachScenario {
  return scenario === "tired" || scenario === "pain" || scenario === "time" || scenario === "equipment";
}

const nonWorkoutFallback: Record<"nutrition" | "general" | "off_topic", { reply: string; changes: string[] }> = {
  nutrition: {
    reply:
      "For a real diet plan built around your goal, head to Nutrition → Build a diet plan — it asks a few quick questions and builds a sample day for you.",
    changes: ["Answer a few quick questions there", "Get a sample day sized to your goal", "Revisit it anytime in Nutrition"],
  },
  general: {
    reply: "Live AI is unavailable right now. Ask about fatigue, discomfort, limited time, or limited equipment and I can adjust today's session.",
    changes: [],
  },
  off_topic: {
    reply: "I'm focused on your training — ask me about today's session, technique, recovery, or your plan.",
    changes: [],
  },
};

function AICoachScreen({
  profile,
  workoutHistory,
  exerciseProgress,
  messages,
  onMessagesChange,
  onBack,
  onApply,
  onStartWorkout,
  onOpenDietPlan,
}: {
  profile: Record<string, string>;
  workoutHistory: WorkoutHistoryEntry[];
  exerciseProgress: Record<string, ExerciseProgress>;
  messages: CoachMessage[];
  onMessagesChange: (updater: (current: CoachMessage[]) => CoachMessage[]) => void;
  onBack: () => void;
  onApply: (scenario: CoachScenario) => void;
  onStartWorkout: () => void;
  onOpenDietPlan: () => void;
}) {
  const [draft, setDraft] = useState("");
  const [isThinking, setIsThinking] = useState(false);
  const [coachError, setCoachError] = useState("");
  const scrollRef = useRef<ScrollView>(null);
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const goalLabel =
    profile.goal === "fat-loss"
      ? "fat-loss"
      : profile.goal === "strength"
        ? "strength"
        : profile.goal === "muscle"
          ? "muscle-building"
          : "fitness";

  const askCoach = async (message: string, fallbackScenario: ResolvedCoachScenario) => {
    // Everything already in the thread becomes conversation history for this
    // turn -- the coach sees what was said before, not just this one message.
    const history = messagesRef.current.slice(-30).map((entry) => ({
      role: entry.role === "user" ? "user" : "assistant",
      content: entry.text,
    }));
    onMessagesChange((current) => [...current, { id: `${Date.now()}-user`, role: "user", text: message }]);
    setIsThinking(true);
    setCoachError("");
    try {
      const response = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          profile,
          memory: summarizeCoachMemory(workoutHistory, exerciseProgress),
          history,
        }),
      });
      if (!response.ok) throw new Error("Coach request failed");
      const result = (await response.json()) as {
        reply?: string;
        scenario?: ResolvedCoachScenario;
        changes?: string[];
        requiresHumanReview?: boolean;
      };
      const resolvedScenario: ResolvedCoachScenario = result.scenario ?? fallbackScenario;
      onMessagesChange((current) => [
        ...current,
        {
          id: `${Date.now()}-ai`,
          role: "ai",
          text:
            result.reply ??
            (isActionableScenario(resolvedScenario)
              ? coachScenarios[resolvedScenario].reply
              : nonWorkoutFallback[resolvedScenario].reply),
          scenario: resolvedScenario,
          changes: result.changes?.length
            ? result.changes
            : isActionableScenario(resolvedScenario)
              ? coachScenarios[resolvedScenario].changes
              : nonWorkoutFallback[resolvedScenario].changes,
          requiresHumanReview: Boolean(result.requiresHumanReview),
          applied: false,
          reviewStatus: "idle",
        },
      ]);
    } catch {
      onMessagesChange((current) => [
        ...current,
        {
          id: `${Date.now()}-ai`,
          role: "ai",
          text: isActionableScenario(fallbackScenario)
            ? coachScenarios[fallbackScenario].reply
            : nonWorkoutFallback[fallbackScenario].reply,
          scenario: fallbackScenario,
          changes: isActionableScenario(fallbackScenario)
            ? coachScenarios[fallbackScenario].changes
            : nonWorkoutFallback[fallbackScenario].changes,
          applied: false,
          reviewStatus: "idle",
        },
      ]);
      setCoachError("Live AI is unavailable. Safe coaching mode is active.");
    } finally {
      setIsThinking(false);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 80);
    }
  };

  const requestCoachReview = async (item: CoachMessage, precedingUserText: string) => {
    onMessagesChange((current) =>
      current.map((entry) => (entry.id === item.id ? { ...entry, reviewStatus: "sending" } : entry)),
    );
    try {
      const response = await fetch("/api/request-review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: precedingUserText, reply: item.text, profile }),
      });
      if (!response.ok) throw new Error("Review request failed");
      onMessagesChange((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, reviewStatus: "sent" } : entry)),
      );
    } catch {
      onMessagesChange((current) =>
        current.map((entry) => (entry.id === item.id ? { ...entry, reviewStatus: "error" } : entry)),
      );
    }
  };

  const chooseScenario = (next: CoachScenario) => {
    void askCoach(coachScenarios[next].user, next);
  };

  const sendCustomMessage = () => {
    const message = draft.trim();
    if (!message) return;
    const normalized = message.toLowerCase();
    const inferredScenario: ResolvedCoachScenario =
      normalized.includes("pain") || normalized.includes("hurt") || normalized.includes("бол")
        ? "pain"
        : normalized.includes("minute") || normalized.includes("time") || normalized.includes("врем")
          ? "time"
          : normalized.includes("equipment") || normalized.includes("gym") || normalized.includes("уред")
            ? "equipment"
            : normalized.includes("diet") ||
                normalized.includes("nutrition") ||
                normalized.includes("meal") ||
                normalized.includes("eat") ||
                normalized.includes("режим") ||
                normalized.includes("диет") ||
                normalized.includes("храна") ||
                normalized.includes("ядене")
              ? "nutrition"
              : "tired";
    setDraft("");
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
                <Text style={styles.coachOnlineText}>AI + HUMAN REVIEW</Text>
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
              <Pressable key={key} onPress={() => chooseScenario(key)} style={styles.coachQuickAction}>
                <Text style={styles.coachQuickActionText}>{coachScenarios[key].label}</Text>
              </Pressable>
            ))}
          </View>

          {messages.map((item, index) =>
            item.role === "user" ? (
              <View key={item.id} style={styles.userBubble}>
                <Text style={styles.userBubbleText}>{item.text}</Text>
              </View>
            ) : (
              <View key={item.id}>
                <View style={styles.coachBubbleRow}>
                  <View style={styles.coachBubbleMark}><Text style={styles.coachBubbleMarkText}>G</Text></View>
                  <View style={styles.coachBubble}>
                    <Text style={styles.coachBubbleText}>{item.text}</Text>
                  </View>
                </View>

                {item.scenario && isActionableScenario(item.scenario) ? (
                  <View style={styles.coachAdjustmentCard}>
                    <View style={styles.coachAdjustmentTop}>
                      <Text style={styles.coachAdjustmentLabel}>ADJUSTED WORKOUT</Text>
                      <Text style={styles.coachAdjustmentBadge}>AI PROPOSAL</Text>
                    </View>
                    {(item.changes ?? []).map((change) => (
                      <View key={change} style={styles.coachChangeRow}>
                        <Text style={styles.coachChangeCheck}>✓</Text>
                        <Text style={styles.coachChangeText}>{change}</Text>
                      </View>
                    ))}
                    <Pressable
                      onPress={() => {
                        onApply(item.scenario as CoachScenario);
                        onMessagesChange((current) =>
                          current.map((entry) => (entry.id === item.id ? { ...entry, applied: true } : entry)),
                        );
                      }}
                      disabled={item.applied}
                      style={[styles.coachApplyButton, item.applied && styles.coachApplyButtonDone]}
                    >
                      <Text style={styles.coachApplyButtonText}>
                        {item.applied ? "PLAN UPDATED ✓" : "APPLY CHANGES"}
                      </Text>
                    </Pressable>
                    {item.applied ? (
                      <Pressable onPress={onStartWorkout} style={styles.coachStartButton}>
                        <Text style={styles.coachStartButtonText}>START ADAPTED WORKOUT</Text>
                        <Text style={styles.coachStartButtonArrow}>→</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : item.scenario === "nutrition" ? (
                  <View style={styles.coachAdjustmentCard}>
                    <View style={styles.coachAdjustmentTop}>
                      <Text style={styles.coachAdjustmentLabel}>NUTRITION</Text>
                      <Text style={styles.coachAdjustmentBadge}>AI SUGGESTION</Text>
                    </View>
                    {(item.changes ?? []).map((change) => (
                      <View key={change} style={styles.coachChangeRow}>
                        <Text style={styles.coachChangeCheck}>✓</Text>
                        <Text style={styles.coachChangeText}>{change}</Text>
                      </View>
                    ))}
                    <Pressable onPress={onOpenDietPlan} style={styles.coachApplyButton}>
                      <Text style={styles.coachApplyButtonText}>OPEN DIET PLAN</Text>
                    </Pressable>
                  </View>
                ) : null}

                {item.requiresHumanReview ? (
                  <View style={styles.coachAdjustmentCard}>
                    <View style={styles.coachAdjustmentTop}>
                      <Text style={styles.coachAdjustmentLabel}>HUMAN REVIEW</Text>
                      <Text style={styles.coachAdjustmentBadge}>REAL COACH</Text>
                    </View>
                    <Text style={styles.coachChangeText}>
                      {item.reviewStatus === "sent"
                        ? "Sent to your coach — typically answered within 24–48h."
                        : item.reviewStatus === "error"
                          ? "Could not send that just now. Try again shortly."
                          : "Flag this for your real coach to review directly."}
                    </Text>
                    <Pressable
                      onPress={() => requestCoachReview(item, messages[index - 1]?.text ?? "")}
                      disabled={item.reviewStatus === "sending" || item.reviewStatus === "sent"}
                      style={[
                        styles.coachApplyButton,
                        item.reviewStatus === "sent" && styles.coachApplyButtonDone,
                      ]}
                    >
                      <Text style={styles.coachApplyButtonText}>
                        {item.reviewStatus === "sending"
                          ? "SENDING..."
                          : item.reviewStatus === "sent"
                            ? "REQUEST SENT ✓"
                            : "REQUEST COACH REVIEW"}
                      </Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            ),
          )}

          {isThinking ? (
            <View style={styles.coachBubbleRow}>
              <View style={styles.coachBubbleMark}><Text style={styles.coachBubbleMarkText}>G</Text></View>
              <View style={styles.coachBubble}>
                <Text style={styles.coachBubbleText}>Thinking about the safest useful adjustment…</Text>
              </View>
            </View>
          ) : null}

          {coachError && !isThinking ? <Text style={styles.coachFallbackText}>{coachError}</Text> : null}
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
  formFrames: [ImageSourcePropType, ImageSourcePropType];
  poseGuide: PoseGuide;
  video?: number | string;
  // Only present for exercises sourced from the live MuscleWiki catalog --
  // needed to look up "similar exercise" alternatives. Absent for the
  // built-in fallback roster, which has no such data to search by.
  catalogMeta?: {
    externalId: number;
    movementPattern: MovementPattern;
    primaryMuscle: PrimaryMuscle;
  };
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

const BASE_SET_COUNT_BY_FREQUENCY: Record<string, number> = {
  "2": 4,
  "3": 3,
  "4": 3,
  "5": 2,
};

// Fat-loss/general-fitness goals train for density (more total work in the
// session) rather than pure strength/hypertrophy load, so they get one extra
// set per exercise on top of the frequency-based baseline.
function setCountForProfile(
  profile: Record<string, string>,
  adjustment?: CoachScenario | null,
  isDeload?: boolean,
): number {
  const baseSetCount = BASE_SET_COUNT_BY_FREQUENCY[profile.frequency ?? "3"] ?? 3;
  const densityBonus = profile.goal === "fat-loss" || profile.goal === "fitness" ? 1 : 0;
  const reduction = (adjustment === "tired" ? 1 : 0) + (isDeload ? 1 : 0);
  return Math.max(2, baseSetCount + densityBonus - reduction);
}

const REFERENCE_BODY_WEIGHT_KG = 70;
// MET (metabolic equivalent) for moderate-effort resistance training,
// per the Compendium of Physical Activities. calories ≈ MET × kg × hours.
const RESISTANCE_TRAINING_MET = 5;

function estimateSessionCalories(bodyWeightKg: number, elapsedSeconds: number): number {
  const weightKg = Number.isFinite(bodyWeightKg) && bodyWeightKg > 0 ? bodyWeightKg : REFERENCE_BODY_WEIGHT_KG;
  const hours = elapsedSeconds / 3600;
  return Math.max(0, Math.round(RESISTANCE_TRAINING_MET * weightKg * hours));
}

export type DietMode = "bulk" | "cut" | "recomp";

// The Nutrition screen lets the user set this directly, independent of the
// training goal (someone training for "muscle" can still be mid-cut, and
// vice versa). Falls back to inferring from the training goal for anyone
// who hasn't touched the new toggle yet, so existing profiles keep working.
function inferDietMode(profile: Record<string, string>): DietMode {
  if (profile.dietMode === "bulk" || profile.dietMode === "cut" || profile.dietMode === "recomp") {
    return profile.dietMode;
  }
  return profile.goal === "muscle" ? "bulk" : profile.goal === "fat-loss" ? "cut" : "recomp";
}

// Standard sports-nutrition range for active adults is roughly 1.6-2.2g of
// protein per kg of body weight; this is a general heuristic, not medical
// or dietary advice. Protein stays high across all three modes -- a cut
// needs it most to preserve muscle in a deficit, recomp needs it to build
// while at maintenance, and bulk needs it to actually use the surplus.
function dailyProteinTargetGrams(profile: Record<string, string>): number {
  const bodyWeightKg = Number(profile.weight);
  const weightKg = Number.isFinite(bodyWeightKg) && bodyWeightKg > 0 ? bodyWeightKg : REFERENCE_BODY_WEIGHT_KG;
  const factor = inferDietMode(profile) === "cut" ? 2.2 : 2.0;
  return Math.round(weightKg * factor);
}

// A rough Mifflin-St Jeor-style maintenance estimate scaled by diet mode;
// this is a general heuristic to size a sample meal plan, not medical or
// dietary advice. Recomp trains at maintenance -- no surplus or deficit --
// relying on the higher protein target above to do the work instead.
function dailyCalorieTargetKcal(profile: Record<string, string>): number {
  const bodyWeightKg = Number(profile.weight);
  const weightKg = Number.isFinite(bodyWeightKg) && bodyWeightKg > 0 ? bodyWeightKg : REFERENCE_BODY_WEIGHT_KG;
  const maintenance = weightKg * 30;
  const mode = inferDietMode(profile);
  const factor = mode === "cut" ? 0.82 : mode === "bulk" ? 1.12 : 1;
  return Math.round((maintenance * factor) / 10) * 10;
}

function scaledStartingWeightLabel(baseKg: number, bodyWeightKg: number): string {
  if (!Number.isFinite(bodyWeightKg) || bodyWeightKg <= 0) return `${baseKg} kg`;
  const factor = Math.min(1.3, Math.max(0.75, bodyWeightKg / REFERENCE_BODY_WEIGHT_KG));
  const scaledKg = Math.max(2, Math.round(baseKg * factor));
  return `${scaledKg} kg`;
}

// Classic strength/hypertrophy/endurance rep ranges, picked per training
// goal instead of one number for everyone -- strength trains low-rep/heavy,
// hypertrophy (muscle) trains moderate reps, fat-loss/fitness train
// higher-rep for metabolic density. "health" gets a moderate general baseline.
const GOAL_REP_TARGET: Record<string, number> = {
  strength: 5,
  muscle: 10,
  "fat-loss": 14,
  fitness: 12,
  health: 10,
};

// Rest between sets follows the same logic: strength needs full recovery to
// keep the weight heavy, fat-loss/fitness keep rest short to stay in a
// higher heart-rate, higher-density zone.
const GOAL_REST_SECONDS: Record<string, number> = {
  strength: 120,
  muscle: 75,
  "fat-loss": 40,
  fitness: 45,
  health: 60,
};

function baseRepsForProfile(profile: Record<string, string>): number {
  const ageYears = Number(profile.age);
  const reducedLoad =
    (Number.isFinite(ageYears) && ageYears >= 45) ||
    profile.experience === "beginner";
  const target = GOAL_REP_TARGET[profile.goal ?? ""] ?? 10;
  return reducedLoad ? Math.max(4, target - 2) : target;
}

function restSecondsForProfile(profile: Record<string, string>, adjustment?: CoachScenario | null): number {
  const base = GOAL_REST_SECONDS[profile.goal ?? ""] ?? 60;
  return adjustment === "tired" ? base + 30 : base;
}

// A same-day readiness discount applied to suggested weight -- only ever
// reduces load, never adds to it, since normal double-progression already
// handles increases and an algorithm should never talk someone into more
// weight than usual on a day it has no real evidence they're ready for.
// Two signals are available today: how recently they last trained (real
// under-recovery, not just "yesterday" being close by design) and whether
// they told the coach they're tired going into this session. Sleep and
// diet-adherence trend aren't tracked yet, so they're left out rather than
// guessed at -- see the memory note for why.
function readinessWeightModifier(workoutHistory: WorkoutHistoryEntry[], adjustment?: CoachScenario | null): number {
  let modifier = 1;
  const hoursSince = hoursSinceLastWorkout(workoutHistory);
  if (hoursSince !== null && hoursSince < 20) modifier -= 0.06;
  if (adjustment === "tired") modifier -= 0.06;
  return Math.max(0.88, modifier);
}

// Isometric holds (plank and its variants) are timed, not counted -- "10
// reps" of a hold means nothing, so these get a starting hold length in
// seconds instead, and the UI shows "sec" wherever it would otherwise show
// "reps" for this exercise.
function holdSecondsForProfile(profile: Record<string, string>): number {
  return profile.experience === "beginner" ? 20 : profile.experience === "advanced" ? 40 : 30;
}

function isHoldExercise(exercise: { name: string; catalogMeta?: { movementPattern?: string } }): boolean {
  return exercise.catalogMeta?.movementPattern === "isometric" || exercise.name.includes("Plank");
}

function isBodyweightExerciseName(name: string): boolean {
  return (
    name.includes("Push-Up") ||
    name.includes("Plank") ||
    name.includes("Glute Bridge") ||
    name.includes("Bodyweight") ||
    name.includes("Mountain Climbers") ||
    name.includes("High Knees") ||
    name.includes("Burpee") ||
    name.includes("Pull-Up") ||
    name.includes("Bar Dip") ||
    name.includes("Knee Raise") ||
    name.includes("Hanging Leg Raise")
  );
}

function createWorkout(
  profile: Record<string, string>,
  exerciseProgress: Record<string, ExerciseProgress> = {},
): WorkoutExercise[] {
  const bodyWeightKg = Number(profile.weight);
  const ageYears = Number(profile.age);
  const reducedLoad =
    (Number.isFinite(ageYears) && ageYears >= 45) ||
    profile.experience === "beginner";
  const reps = String(baseRepsForProfile(profile));
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
    {
      ...workoutExercises[2]!,
      name: "Dumbbell Row",
      target: "Back · Controlled",
      video: require("./assets/exercise-videos/female-dumbbell-row.mp4"),
      phases: ["REACH", "PULL", "RETURN"],
      formFrames: [
        require("./assets/exercises/female-dumbbell-row/start.jpg"),
        require("./assets/exercises/female-dumbbell-row/finish.jpg"),
      ],
      poseGuide: poseGuides.row!,
    },
    {
      ...workoutExercises[2]!,
      name: "Glute Bridge",
      target: "Glutes · Isolation",
      video: require("./assets/exercise-videos/female-glute-bridge.mp4"),
      phases: ["LOWER", "HOLD", "LIFT"],
      formFrames: [
        require("./assets/exercises/female-glute-bridge/start.jpg"),
        require("./assets/exercises/female-glute-bridge/finish.jpg"),
      ],
      poseGuide: poseGuides.hinge!,
    },
    {
      ...workoutExercises[1]!,
      name: "Plank",
      target: "Core · Isometric",
      tempo: "HOLD",
      video: require("./assets/exercise-videos/female-plank.mp4"),
      phases: ["BRACE", "HOLD", "HOLD"],
      formFrames: [
        require("./assets/exercises/female-plank/start.jpg"),
        require("./assets/exercises/female-plank/finish.jpg"),
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
    {
      ...workoutExercises[0]!,
      name: "Dumbbell Lunge",
      target: "Legs & glutes · Unilateral",
      video: require("./assets/exercise-videos/male-dumbbell-lunge.mp4"),
      phases: ["STEP", "LOWER", "DRIVE"],
      formFrames: [
        require("./assets/exercises/male-dumbbell-lunge/start.jpg"),
        require("./assets/exercises/male-dumbbell-lunge/finish.jpg"),
      ],
    },
    {
      ...workoutExercises[0]!,
      name: "Calf Raise",
      target: "Calves · Isolation",
      video: require("./assets/exercise-videos/male-calf-raise.mp4"),
      phases: ["LOWER", "HOLD", "RAISE"],
      formFrames: [
        require("./assets/exercises/male-calf-raise/start.jpg"),
        require("./assets/exercises/male-calf-raise/finish.jpg"),
      ],
    },
    {
      ...workoutExercises[1]!,
      name: "Plank",
      target: "Core · Isometric",
      tempo: "HOLD",
      video: require("./assets/exercise-videos/male-plank.mp4"),
      phases: ["BRACE", "HOLD", "HOLD"],
      formFrames: [
        require("./assets/exercises/male-plank/start.jpg"),
        require("./assets/exercises/male-plank/finish.jpg"),
      ],
    },
  ];
  const femaleBodyweightExercises: WorkoutExercise[] = [
    {
      ...workoutExercises[0]!,
      name: "Bodyweight Squat",
      target: "Lower body · Bodyweight",
      video: require("./assets/exercise-videos/female-bodyweight-squat.mp4"),
      phases: ["LOWER", "HOLD", "DRIVE"],
      formFrames: [
        require("./assets/exercises/female-bodyweight-squat/start.jpg"),
        require("./assets/exercises/female-bodyweight-squat/finish.jpg"),
      ],
    },
    {
      ...workoutExercises[0]!,
      name: "Push-Up",
      target: "Chest & triceps · Bodyweight",
      video: require("./assets/exercise-videos/female-push-up.mp4"),
      phases: ["LOWER", "HOLD", "PRESS"],
      formFrames: [
        require("./assets/exercises/female-bodyweight-pushup/start.jpg"),
        require("./assets/exercises/female-bodyweight-pushup/finish.jpg"),
      ],
    },
    {
      ...workoutExercises[0]!,
      name: "Bodyweight Reverse Lunge",
      target: "Legs & glutes · Unilateral",
      video: require("./assets/exercise-videos/female-bodyweight-lunge.mp4"),
      phases: ["STEP", "LOWER", "DRIVE"],
      formFrames: [
        require("./assets/exercises/female-bodyweight-lunge/start.jpg"),
        require("./assets/exercises/female-bodyweight-lunge/finish.jpg"),
      ],
    },
    {
      ...workoutExercises[2]!,
      name: "Glute Bridge",
      target: "Glutes · Isolation",
      video: require("./assets/exercise-videos/female-glute-bridge.mp4"),
      phases: ["LOWER", "HOLD", "LIFT"],
      formFrames: [
        require("./assets/exercises/female-glute-bridge/start.jpg"),
        require("./assets/exercises/female-glute-bridge/finish.jpg"),
      ],
      poseGuide: poseGuides.hinge!,
    },
    {
      ...workoutExercises[1]!,
      name: "Plank",
      target: "Core · Isometric",
      tempo: "HOLD",
      video: require("./assets/exercise-videos/female-plank.mp4"),
      phases: ["BRACE", "HOLD", "HOLD"],
      formFrames: [
        require("./assets/exercises/female-plank/start.jpg"),
        require("./assets/exercises/female-plank/finish.jpg"),
      ],
    },
    {
      ...workoutExercises[1]!,
      name: "Mountain Climbers",
      target: "Core & cardio · Bodyweight",
      tempo: "FAST",
      video: require("./assets/exercise-videos/female-mountain-climbers.mp4"),
      phases: ["BRACE", "DRIVE", "SWITCH"],
      formFrames: [
        require("./assets/exercises/female-mountain-climbers/start.jpg"),
        require("./assets/exercises/female-mountain-climbers/finish.jpg"),
      ],
    },
  ];
  const maleBodyweightExercises: WorkoutExercise[] = [
    {
      ...workoutExercises[0]!,
      name: "Bodyweight Squat",
      target: "Lower body · Bodyweight",
      video: require("./assets/exercise-videos/male-bodyweight-squat.mp4"),
      phases: ["LOWER", "HOLD", "DRIVE"],
      formFrames: [
        require("./assets/exercises/male-bodyweight-squat/start.jpg"),
        require("./assets/exercises/male-bodyweight-squat/finish.jpg"),
      ],
    },
    {
      ...workoutExercises[0]!,
      name: "Push-Up",
      target: "Chest & triceps · Bodyweight",
      video: require("./assets/exercise-videos/male-push-up.mp4"),
      phases: ["LOWER", "HOLD", "PRESS"],
    },
    {
      ...workoutExercises[0]!,
      name: "Bodyweight Reverse Lunge",
      target: "Legs & glutes · Unilateral",
      video: require("./assets/exercise-videos/male-bodyweight-lunge.mp4"),
      phases: ["STEP", "LOWER", "DRIVE"],
      formFrames: [
        require("./assets/exercises/male-bodyweight-lunge/start.jpg"),
        require("./assets/exercises/male-bodyweight-lunge/finish.jpg"),
      ],
    },
    {
      ...workoutExercises[1]!,
      name: "Burpee",
      target: "Full body · Cardio",
      tempo: "FAST",
      video: require("./assets/exercise-videos/male-burpee.mp4"),
      phases: ["SQUAT", "PLANK", "JUMP"],
      formFrames: [
        require("./assets/exercises/male-burpee/start.jpg"),
        require("./assets/exercises/male-burpee/finish.jpg"),
      ],
    },
    {
      ...workoutExercises[1]!,
      name: "Plank",
      target: "Core · Isometric",
      tempo: "HOLD",
      video: require("./assets/exercise-videos/male-plank.mp4"),
      phases: ["BRACE", "HOLD", "HOLD"],
      formFrames: [
        require("./assets/exercises/male-plank/start.jpg"),
        require("./assets/exercises/male-plank/finish.jpg"),
      ],
    },
    {
      ...workoutExercises[1]!,
      name: "High Knees",
      target: "Core & cardio · Bodyweight",
      tempo: "FAST",
      video: require("./assets/exercise-videos/male-high-knees.mp4"),
      phases: ["DRIVE", "SWITCH", "DRIVE"],
      formFrames: [
        require("./assets/exercises/male-high-knees/start.jpg"),
        require("./assets/exercises/male-high-knees/finish.jpg"),
      ],
    },
  ];
  // Starter roster for the "Pull-up bar / calisthenics" equipment tier -- intentionally
  // smaller than the other tiers (2-3 exercises) since only a handful of real,
  // fully-visible, gender-matched bar-exercise videos exist so far. Expand once more
  // footage is sourced; do not pad it with unrelated exercises relabeled as bar work.
  const femaleBarsExercises: WorkoutExercise[] = [
    {
      ...workoutExercises[1]!,
      name: "Bar Dip",
      target: "Chest & triceps · Bodyweight",
      video: require("./assets/exercise-videos/female-bar-dip.mp4"),
      phases: ["BRACE", "LOWER", "PRESS"],
      formFrames: [
        require("./assets/exercises/female-bar-dip/start.jpg"),
        require("./assets/exercises/female-bar-dip/finish.jpg"),
      ],
    },
    {
      ...workoutExercises[1]!,
      name: "Knee Raise",
      target: "Core · Bodyweight",
      video: require("./assets/exercise-videos/female-knee-raise.mp4"),
      phases: ["BRACE", "RAISE", "LOWER"],
      formFrames: [
        require("./assets/exercises/female-knee-raise/start.jpg"),
        require("./assets/exercises/female-knee-raise/finish.jpg"),
      ],
    },
  ];
  const maleBarsExercises: WorkoutExercise[] = [
    {
      ...workoutExercises[0]!,
      name: "Pull-Up",
      target: "Back & biceps · Bodyweight",
      video: require("./assets/exercise-videos/male-pull-up.mp4"),
      phases: ["HANG", "PULL", "LOWER"],
      formFrames: [
        require("./assets/exercises/male-pull-up/start.jpg"),
        require("./assets/exercises/male-pull-up/finish.jpg"),
      ],
    },
    {
      ...workoutExercises[1]!,
      name: "Bar Dip",
      target: "Chest & triceps · Bodyweight",
      video: require("./assets/exercise-videos/male-bar-dip.mp4"),
      phases: ["BRACE", "LOWER", "PRESS"],
      formFrames: [
        require("./assets/exercises/male-bar-dip/start.jpg"),
        require("./assets/exercises/male-bar-dip/finish.jpg"),
      ],
    },
    {
      ...workoutExercises[1]!,
      name: "Hanging Leg Raise",
      target: "Core · Bodyweight",
      video: require("./assets/exercise-videos/male-hanging-leg-raise.mp4"),
      phases: ["HANG", "RAISE", "LOWER"],
      formFrames: [
        require("./assets/exercises/male-hanging-leg-raise/start.jpg"),
        require("./assets/exercises/male-hanging-leg-raise/finish.jpg"),
      ],
    },
  ];
  const isBodyweightTier = profile.equipment === "bodyweight";
  const isBarsTier = profile.equipment === "bars";
  const selectedBase = isBarsTier
    ? profile.sex === "female"
      ? femaleBarsExercises
      : profile.sex === "male"
        ? maleBarsExercises
        : femaleBarsExercises
    : isBodyweightTier
      ? profile.sex === "female"
        ? femaleBodyweightExercises
        : profile.sex === "male"
          ? maleBodyweightExercises
          : femaleBodyweightExercises
      : profile.sex === "female"
        ? femaleExercises
        : profile.sex === "male"
          ? maleExercises
          : workoutExercises;
  const exercises = selectedBase.map((exercise) => {
    const isBodyweight = isBodyweightExerciseName(exercise.name);
    const saved = exerciseProgress[exercise.name];
    return {
      ...exercise,
      reps: saved
        ? String(saved.reps)
        : exercise.name.includes("Plank")
          ? String(holdSecondsForProfile(profile))
          : reps,
      tempo: Number.isFinite(ageYears) && ageYears >= 55 ? "3–1–2" : exercise.tempo,
      weight: isBodyweight
        ? "Bodyweight"
        : saved
          ? `${saved.weightKg} kg`
          : scaledStartingWeightLabel(
              exercise.name.includes("Squat")
                ? reducedLoad ? 8 : profile.sex === "male" ? 20 : 14
                : exercise.name === "Dumbbell Press"
                  ? reducedLoad ? 6 : profile.sex === "male" ? 16 : 10
                  : reducedLoad ? 15 : profile.sex === "male" ? 30 : 22,
              bodyWeightKg,
            ),
    };
  });

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

function catalogExerciseToWorkoutExercise(
  tag: ExerciseTag,
  profile: Record<string, string>,
  exerciseProgress: Record<string, ExerciseProgress>,
  isDeload: boolean = false,
  weightModifier: number = 1,
): WorkoutExercise {
  const bodyWeightKg = Number(profile.weight);
  const isBodyweight = tag.equipment.toLowerCase() === "bodyweight";
  const saved = exerciseProgress[tag.name];
  const reps = saved
    ? String(saved.reps)
    : String(tag.movementPattern === "isometric" ? holdSecondsForProfile(profile) : baseRepsForProfile(profile));
  // Deload week backs off the weight on its own (lighter session, not a rest
  // day) -- the readiness modifier is for everything else (poor recovery,
  // self-reported "tired"), so the two never stack; deload wins when both apply.
  const savedWeightKg = saved
    ? isDeload
      ? Math.max(2, Math.round(saved.weightKg * 0.85))
      : Math.max(2, Math.round(saved.weightKg * weightModifier))
    : null;
  const weight = isBodyweight
    ? "Bodyweight"
    : savedWeightKg !== null
      ? `${savedWeightKg} kg`
      : scaledStartingWeightLabel(Math.round(12 * (isDeload ? 0.85 : weightModifier)), bodyWeightKg);
  const media = tag.media[profile.sex === "male" ? "male" : "female"];
  const poster: ImageSourcePropType = media
    ? { uri: media.poster }
    : require("./assets/exercises/goblet-squat/start.jpg");

  return {
    name: tag.name,
    target: `${tag.primaryMuscle.replace("-", " ")} · ${tag.movementPattern}`,
    weight,
    reps,
    tempo: "3-1-1",
    phases: ["LOWER", "BRACE", "LIFT"],
    formFrames: [poster, poster],
    poseGuide: poseGuides.squat!,
    video: media?.video,
    catalogMeta: {
      externalId: tag.source.externalId,
      movementPattern: tag.movementPattern,
      primaryMuscle: tag.primaryMuscle,
    },
  };
}

// Representative search keyword per movement pattern, used to look up
// "similar exercise" alternatives for the swap feature.
const movementPatternSearchKeyword: Record<MovementPattern, string> = {
  squat: "squat",
  hinge: "deadlift",
  push: "press",
  pull: "row",
  lunge: "lunge",
  carry: "carry",
  rotation: "twist",
  isometric: "plank",
};

async function fetchAlternativeExercises(
  catalogMeta: { externalId: number; movementPattern: MovementPattern; primaryMuscle: PrimaryMuscle },
  profile: Record<string, string>,
  exerciseProgress: Record<string, ExerciseProgress>,
  excludeNames: Set<string>,
  isDeload: boolean = false,
  weightModifier: number = 1,
): Promise<WorkoutExercise[]> {
  const keyword = movementPatternSearchKeyword[catalogMeta.movementPattern];
  const params = new URLSearchParams({ search: keyword, limit: "25" });
  const response = await fetch(`/api/exercise-catalog?${params.toString()}`);
  if (!response.ok) return [];
  const body = (await response.json()) as { exercises?: ExerciseTag[] };
  const sex = profile.sex === "male" ? "male" : "female";
  const alternatives = (body.exercises ?? []).filter(
    (candidate) =>
      candidate.primaryMuscle === catalogMeta.primaryMuscle &&
      candidate.source.externalId !== catalogMeta.externalId &&
      !excludeNames.has(candidate.name) &&
      candidate.media[sex] !== null,
  );
  return alternatives
    .slice(0, 5)
    .map((tag) => catalogExerciseToWorkoutExercise(tag, profile, exerciseProgress, isDeload, weightModifier));
}

async function createWorkoutFromCatalog(
  profile: Record<string, string>,
  exerciseProgress: Record<string, ExerciseProgress>,
  workoutHistory: WorkoutHistoryEntry[],
  coachAdjustment: CoachScenario | null,
): Promise<{
  exercises: WorkoutExercise[];
  splitLabel: string;
  splitDay: SplitDay;
  isDeload: boolean;
  weightModifier: number;
} | null> {
  const equipmentMap: Record<string, ProgramBuilderProfile["equipment"]> = {
    gym: "gym",
    "home-gym": "home-gym",
    minimal: "minimal",
    bodyweight: "bodyweight",
    bars: "bars",
  };
  const limitationsMap: Record<string, ProgramBuilderProfile["limitations"]> = {
    knee: "knee",
    shoulder: "shoulder",
    back: "back",
    none: "none",
    "coach-review": "coach-review",
  };

  const builderProfile: ProgramBuilderProfile = {
    equipment: equipmentMap[profile.equipment ?? ""] ?? "minimal",
    experience: (profile.experience as ProgramBuilderProfile["experience"]) ?? "beginner",
    limitations: limitationsMap[profile.limitations ?? ""] ?? "none",
    sex: profile.sex === "male" ? "male" : "female",
  };

  const reminderDays = profile.reminderDays ? profile.reminderDays.split(",") : [];
  const { day: splitDay, label: splitLabel } = determineSplitDay(reminderDays, recentSplitDaysFromHistory(workoutHistory));
  const { isDeload } = getMesocycleWeek(workoutHistory);
  const weightModifier = isDeload ? 1 : readinessWeightModifier(workoutHistory, coachAdjustment);

  try {
    const tags = await buildProgram(builderProfile, splitDay);
    // Split templates range from 4 (push/pull) to 8 (full-body) slots -- judge
    // "did this work" against a floor, not a fixed count meant for full-body.
    if (tags.length < 4) {
      console.error(`Catalog program only filled ${tags.length} slots for "${splitDay}" -- falling back to the built-in workout`);
      return null;
    }
    return {
      exercises: tags.map((tag) =>
        catalogExerciseToWorkoutExercise(tag, profile, exerciseProgress, isDeload, weightModifier),
      ),
      splitLabel,
      splitDay,
      isDeload,
      weightModifier,
    };
  } catch (error) {
    console.error("Catalog workout build failed -- falling back to the built-in workout", error);
    return null;
  }
}

function ExerciseStill({ frame }: { frame: ImageSourcePropType }) {
  return (
    <View style={StyleSheet.absoluteFill}>
      <Image source={frame} style={styles.exerciseFrameBackdrop} resizeMode="cover" />
      <View style={styles.exerciseFrameBackdropShade} />
      <Image source={frame} style={styles.exerciseVideo} resizeMode="contain" />
    </View>
  );
}

function RealExerciseVideo({ source, poster }: { source: number | string; poster: ImageSourcePropType }) {
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

function PreloadExerciseVideo({ source }: { source: number | string }) {
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
  exercises,
}: {
  exerciseIndex: number;
  exercises: WorkoutExercise[];
}) {
  const exercise = exercises[exerciseIndex] ?? exercises[0]!;
  const nextExercise = exercises[exerciseIndex + 1];

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
    </View>
  );
}

function ActiveWorkoutScreen({
  exercises,
  splitLabel,
  splitDay,
  isDeload,
  weightModifier = 1,
  adjustment,
  onExit,
  onViewProgress,
  profile,
  exerciseProgress,
  onUpdateExerciseProgress,
  onCompleteWorkout,
}: {
  exercises: WorkoutExercise[];
  splitLabel?: string | null;
  splitDay?: SplitDay | null;
  isDeload?: boolean;
  weightModifier?: number;
  adjustment?: CoachScenario | null;
  onExit: () => void;
  onViewProgress: () => void;
  profile: Record<string, string>;
  exerciseProgress: Record<string, ExerciseProgress>;
  onUpdateExerciseProgress: (name: string, next: ExerciseProgress) => void;
  onCompleteWorkout: (entry: WorkoutHistoryEntry) => void;
}) {
  const { height } = useWindowDimensions();
  const [exerciseList, setExerciseList] = useState<WorkoutExercise[]>(exercises);
  const baseExercises = exerciseList;
  const personalizedExercises = adjustment === "time" ? baseExercises.slice(0, 3) : baseExercises;
  const targetSetCount = setCountForProfile(profile, adjustment, isDeload);
  const scrollRef = useRef<ScrollView>(null);

  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [completedSets, setCompletedSets] = useState<boolean[]>(Array(targetSetCount).fill(false));
  const [restSeconds, setRestSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [workoutComplete, setWorkoutComplete] = useState(false);
  const [exerciseInfoOpen, setExerciseInfoOpen] = useState(false);
  const [swapState, setSwapState] = useState<"closed" | "loading" | { options: WorkoutExercise[] }>("closed");
  const exercise = personalizedExercises[exerciseIndex] ?? personalizedExercises[0]!;
  const isBodyweight = exercise.weight === "Bodyweight";
  const isHold = isHoldExercise(exercise);
  const currentWeightKg = isBodyweight ? null : parseInt(exercise.weight, 10);
  const currentReps = parseInt(exercise.reps, 10);
  // The video fills whatever's left after the real (measured) height of
  // everything else on screen -- header, optional deload/rest banners, set
  // rows, adjust panel, next-exercise button. A hand-counted pixel budget
  // here previously fit the browser preview's math but still needed
  // scrolling on a real phone (different font metrics, safe-area insets,
  // etc.), so instead of guessing constants we measure the actual rendered
  // height of the sheet below via onLayout and size the video against that,
  // which self-corrects for any screen size or content change (rest timer
  // showing, deload banner, set count, next-exercise button appearing).
  const [sheetHeight, setSheetHeight] = useState(0);
  const [deloadBannerHeight, setDeloadBannerHeight] = useState(0);
  const exerciseVisualHeight = Math.min(
    340,
    Math.max(130, height - 58 - deloadBannerHeight - (sheetHeight || 460) - 18),
  );
  const workoutTitle = splitLabel
    ? splitLabel.toUpperCase()
    : profile.sex === "female"
      ? "WOMEN’S STRENGTH FOUNDATION"
      : profile.sex === "male"
        ? "MEN’S STRENGTH FOUNDATION"
        : "FULL BODY FOUNDATION";

  useEffect(() => {
    if (workoutComplete) return;
    const workoutTimer = setInterval(() => setElapsedSeconds((value) => value + 1), 1000);
    return () => clearInterval(workoutTimer);
  }, [workoutComplete]);

  useEffect(() => {
    if (restSeconds <= 0 || exerciseInfoOpen) return;
    const timer = setInterval(() => setRestSeconds((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [restSeconds, exerciseInfoOpen]);

  const finishSet = (index: number) => {
    const wasDone = completedSets[index];
    setCompletedSets((current) => current.map((value, setIndex) => (setIndex === index ? !value : value)));
    // Rest after every set, including the last one -- when it runs out, an
    // effect below moves on to the next exercise automatically.
    if (!wasDone) {
      setRestSeconds(restSecondsForProfile(profile, adjustment));
    }
  };

  const saveExerciseAdjustment = (nextWeightKg: number, nextReps: number) => {
    onUpdateExerciseProgress(exercise.name, { weightKg: nextWeightKg, reps: nextReps });
  };

  const openSwap = async () => {
    if (!exercise.catalogMeta) return;
    setSwapState("loading");
    const excludeNames = new Set(baseExercises.map((item) => item.name));
    const options = await fetchAlternativeExercises(
      exercise.catalogMeta,
      profile,
      exerciseProgress,
      excludeNames,
      isDeload,
      weightModifier,
    );
    setSwapState({ options });
  };

  const applySwap = (replacement: WorkoutExercise) => {
    setExerciseList((current) =>
      current.map((item, index) => (index === exerciseIndex ? replacement : item)),
    );
    setSwapState("closed");
  };

  // Called when leaving an exercise (moving on, or finishing the workout on
  // the last one). Double progression: add a rep each session until a small
  // ceiling above the profile's base reps, then reset reps and add weight.
  // Progresses from what was actually logged this session (exerciseProgress,
  // already updated live by the kg/reps picker below) rather than the
  // exercise's original planned target -- otherwise a real mid-set adjustment
  // (e.g. going heavier for fewer reps) would just get overwritten here with
  // a number derived from the plan instead of from what really happened.
  const commitExerciseProgress = (finishedExercise: WorkoutExercise) => {
    const logged = exerciseProgress[finishedExercise.name];
    const reps = logged ? logged.reps : parseInt(finishedExercise.reps, 10);
    if (!Number.isFinite(reps)) return;
    if (finishedExercise.weight === "Bodyweight") {
      onUpdateExerciseProgress(finishedExercise.name, { weightKg: 0, reps: reps + 1 });
      return;
    }
    const weightKg = logged ? logged.weightKg : parseInt(finishedExercise.weight, 10);
    if (!Number.isFinite(weightKg)) return;
    const baseReps = baseRepsForProfile(profile);
    const repCeiling = baseReps + 2;
    onUpdateExerciseProgress(
      finishedExercise.name,
      reps < repCeiling ? { weightKg, reps: reps + 1 } : { weightKg: weightKg + 1, reps: baseReps },
    );
  };

  const nextExercise = () => {
    commitExerciseProgress(exercise);
    if (exerciseIndex < personalizedExercises.length - 1) {
      setExerciseIndex((current) => current + 1);
      setCompletedSets(Array(targetSetCount).fill(false));
      setRestSeconds(0);
    }
  };

  useEffect(() => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [exerciseIndex]);

  const finishWorkout = () => {
    commitExerciseProgress(exercise);
    setRestSeconds(0);
    setWorkoutComplete(true);
    onCompleteWorkout({
      id: `${Date.now()}`,
      date: new Date().toISOString(),
      title: workoutTitle,
      exercises: personalizedExercises.length,
      sets: personalizedExercises.length * targetSetCount,
      seconds: elapsedSeconds,
      calories: estimateSessionCalories(Number(profile.weight), elapsedSeconds),
      exerciseBreakdown: personalizedExercises.map((item) => ({
        name: item.name,
        weightKg: isBodyweightExerciseName(item.name) ? null : parseInt(item.weight, 10),
        reps: parseInt(item.reps, 10),
        sets: targetSetCount,
      })),
      ...(splitDay ? { splitDay } : {}),
    });
  };

  const completedCount = completedSets.filter(Boolean).length;

  useEffect(() => {
    if (restSeconds !== 0 || completedCount < targetSetCount || workoutComplete) return;
    if (exerciseIndex === personalizedExercises.length - 1) {
      finishWorkout();
    } else {
      nextExercise();
    }
    // Only react to the rest countdown reaching zero.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restSeconds]);

  const nextSetIndex = completedSets.findIndex((done) => !done);
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
              : exercise.name.includes("Glute Bridge")
                ? {
                    setup: "Lie on your back with knees bent and feet flat, hip-width apart.",
                    movement: "Drive through your heels and lift your hips until your body forms a straight line, then lower with control.",
                    breathing: "Exhale as you lift. Inhale as you lower.",
                    avoid: "Do not overarch the lower back or let the knees splay outward.",
                  }
                : exercise.name.includes("Calf Raise")
                  ? {
                      setup: "Stand tall with the balls of your feet on a raised edge, heels free to drop.",
                      movement: "Rise onto your toes as high as possible, pause, then lower your heels below the step under control.",
                      breathing: "Exhale as you rise. Inhale as you lower.",
                      avoid: "Do not bounce at the bottom or rush the lowering phase.",
                    }
                  : exercise.name.includes("Plank")
                    ? {
                        setup: "Rest on your forearms or hands with your body in one straight line from head to heels.",
                        movement: "Brace your core and hold the position without letting your hips sag or pike up.",
                        breathing: "Breathe steadily throughout the hold. Do not hold your breath.",
                        avoid: "Do not let the hips drop or the head jut forward.",
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
            <Text style={styles.completeStatValue}>{personalizedExercises.length * targetSetCount}</Text>
            <Text style={styles.completeStatLabel}>SETS</Text>
          </View>
          <View style={styles.completeStatDivider} />
          <View style={styles.completeStat}>
            <Text style={styles.completeStatValue}>{elapsedLabel}</Text>
            <Text style={styles.completeStatLabel}>TIME</Text>
          </View>
          <View style={styles.completeStatDivider} />
          <View style={styles.completeStat}>
            <Text style={styles.completeStatValue}>
              {estimateSessionCalories(Number(profile.weight), elapsedSeconds)}
            </Text>
            <Text style={styles.completeStatLabel}>CALORIES</Text>
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
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Exit workout"
          onPress={() => {
            if (completedCount > 0) commitExerciseProgress(exercise);
            onExit();
          }}
          style={styles.workoutClose}
        >
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

      {isDeload ? (
        <View
          style={styles.deloadBanner}
          onLayout={(event) => setDeloadBannerHeight(event.nativeEvent.layout.height)}
        >
          <Text style={styles.deloadBannerText}>DELOAD WEEK · LIGHTER LOAD, SAME EFFORT</Text>
        </View>
      ) : weightModifier < 1 ? (
        <View
          style={styles.deloadBanner}
          onLayout={(event) => setDeloadBannerHeight(event.nativeEvent.layout.height)}
        >
          <Text style={styles.deloadBannerText}>LIGHTER LOAD TODAY · STILL RECOVERING</Text>
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        style={styles.activeWorkoutScroll}
        contentContainerStyle={styles.activeWorkoutScrollContent}
        showsVerticalScrollIndicator={false}
      >
      <View style={[styles.exerciseVisual, { height: exerciseVisualHeight }]}>
        <View style={styles.exerciseGlow} />
        <Text style={styles.exerciseNumber}>0{exerciseIndex + 1}</Text>
        <ExerciseDemo key={exerciseIndex} exerciseIndex={exerciseIndex} exercises={personalizedExercises} />
        <View style={styles.formBadge}>
          <View style={styles.formDot} />
          <Text style={styles.formBadgeText}>{remainingLabel} REMAINING</Text>
        </View>
      </View>

      <View
        style={styles.exerciseSheet}
        onLayout={(event) => setSheetHeight(event.nativeEvent.layout.height)}
      >
        <View style={styles.exerciseHeadingRow}>
          <View>
            <Text style={styles.exerciseStep}>EXERCISE {exerciseIndex + 1} OF {personalizedExercises.length}</Text>
            <Text style={styles.exerciseName}>{exercise.name}</Text>
            <Text style={styles.exerciseTarget}>{exercise.target}</Text>
          </View>
        </View>

        <View style={styles.exerciseActionRow}>
          {exercise.catalogMeta ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Swap ${exercise.name} for a similar exercise`}
              onPress={openSwap}
              style={styles.exerciseActionPill}
            >
              <Text style={styles.exerciseActionPillText}>SWAP EXERCISE</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Exercise guidance for ${exercise.name}`}
            onPress={() => setExerciseInfoOpen(true)}
            style={styles.exerciseActionPill}
          >
            <Text style={styles.exerciseActionPillText}>COACH TIPS</Text>
          </Pressable>
        </View>

        {restSeconds > 0 ? (
          <View style={styles.restBanner}>
            <View>
              <Text style={styles.restLabel}>REST TIMER</Text>
              <Text style={styles.restHint}>
                {completedCount >= targetSetCount
                  ? exerciseIndex === personalizedExercises.length - 1
                    ? "Breathe. Finishing up next."
                    : "Breathe. Next exercise starts after this."
                  : "Breathe. Your next set is ready."}
              </Text>
            </View>
            <View style={styles.restAdjustRow}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Subtract 15 seconds"
                onPress={() => setRestSeconds((value) => Math.max(0, value - 15))}
                style={styles.restAdjustButton}
              >
                <Text style={styles.restAdjustButtonText}>−15</Text>
              </Pressable>
              <Text style={styles.restValue}>0:{String(restSeconds).padStart(2, "0")}</Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Add 15 seconds"
                onPress={() => setRestSeconds((value) => value + 15)}
                style={styles.restAdjustButton}
              >
                <Text style={styles.restAdjustButtonText}>+15</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Skip rest"
                onPress={() => setRestSeconds(0)}
                style={styles.restSkipButton}
              >
                <Text style={styles.restSkipButtonText}>SKIP</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        <View style={styles.setTableHeader}>
          <Text style={[styles.setHeaderText, styles.setColumn]}>SET</Text>
          <Text style={[styles.setHeaderText, styles.weightColumn]}>WEIGHT</Text>
          <Text style={[styles.setHeaderText, styles.repsColumn]}>{isHold ? "SEC" : "REPS"}</Text>
          <View style={styles.doneColumn} />
        </View>

        <View style={styles.setList}>
          {completedSets.map((done, index) => (
            <View key={index} style={[styles.setRow, done && styles.setRowDone]}>
              <Text style={[styles.setIndex, done && styles.setTextDone]}>{index + 1}</Text>
              <Text style={[styles.setValue, styles.weightColumn, done && styles.setTextDone]}>
                {isBodyweight ? "Bodyweight" : `${currentWeightKg} kg`}
              </Text>
              <Text style={[styles.setValue, styles.repsColumn, done && styles.setTextDone]}>
                {isHold ? `${exercise.reps}s` : exercise.reps}
              </Text>
              <View
                accessibilityRole="text"
                accessibilityLabel={done ? `Set ${index + 1} done` : `Set ${index + 1} not done yet`}
                style={[styles.setCheck, done && styles.setCheckDone]}
              >
                <Text style={[styles.setCheckText, done && styles.setCheckTextDone]}>{done ? "✓" : ""}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.adjustPanel}>
          {completedCount < targetSetCount ? (
            <>
              <Text style={styles.adjustPanelLabel}>
                {isHold
                  ? "HOW MANY SECONDS DID YOU HOLD"
                  : isBodyweight
                    ? "HOW MANY REPS DID YOU DO"
                    : "HOW MANY KG & REPS DID YOU DO"}
              </Text>
              <View style={styles.adjustPanelPickers}>
                {!isBodyweight ? (
                  <View style={styles.adjustPanelSlot}>
                    <Text style={styles.adjustPanelColumnLabel}>WEIGHT</Text>
                    <NumberWheelPicker
                      key={`${exercise.name}-weight`}
                      itemHeight={26}
                      visibleItems={3}
                      fontSize={16}
                      min={2}
                      max={100}
                      step={1}
                      unit="kg"
                      value={currentWeightKg ?? 20}
                      onChange={(next) => saveExerciseAdjustment(next, currentReps)}
                    />
                  </View>
                ) : null}
                <View style={styles.adjustPanelSlot}>
                  <Text style={styles.adjustPanelColumnLabel}>{isHold ? "SEC" : "REPS"}</Text>
                  <NumberWheelPicker
                    key={`${exercise.name}-reps`}
                    itemHeight={26}
                    visibleItems={3}
                    fontSize={16}
                    min={isHold ? 5 : 1}
                    max={isHold ? 120 : 30}
                    step={isHold ? 5 : 1}
                    unit={isHold ? "s" : ""}
                    value={currentReps}
                    onChange={(next) => saveExerciseAdjustment(isBodyweight ? 0 : currentWeightKg ?? 20, next)}
                  />
                </View>
              </View>
            </>
          ) : null}
          <View style={styles.adjustPanelMarkRow}>
            <Text style={styles.adjustPanelMarkText}>
              {completedCount === 0
                ? `0 OF ${targetSetCount} SETS DONE`
                : nextSetIndex === -1
                  ? "ALL SETS DONE"
                  : `SET ${completedCount} OF ${targetSetCount} DONE`}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={nextSetIndex === -1 ? "All sets done" : `Mark set ${nextSetIndex + 1} done`}
              disabled={nextSetIndex === -1}
              onPress={() => {
                if (nextSetIndex !== -1) finishSet(nextSetIndex);
              }}
              style={[styles.adjustPanelMarkButton, nextSetIndex === -1 && styles.adjustPanelMarkButtonDone]}
            >
              <Text
                style={[styles.adjustPanelMarkButtonText, nextSetIndex === -1 && styles.adjustPanelMarkButtonTextDone]}
              >
                {nextSetIndex === -1 ? "✓" : `MARK SET ${nextSetIndex + 1} DONE`}
              </Text>
            </Pressable>
          </View>
        </View>


        {completedCount >= targetSetCount ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={
              exerciseIndex === personalizedExercises.length - 1
                ? "Finish workout"
                : "Next exercise"
            }
            onPress={exerciseIndex === personalizedExercises.length - 1 ? finishWorkout : nextExercise}
            style={styles.nextExerciseButton}
          >
            <Text style={styles.nextExerciseText}>
              {exerciseIndex === personalizedExercises.length - 1 ? "FINISH WORKOUT" : "NEXT EXERCISE"}
            </Text>
            <Text style={styles.nextExerciseArrow}>→</Text>
          </Pressable>
        ) : null}
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
                <Text style={styles.exerciseInfoPanelEyebrow}>COACH TIPS</Text>
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

      <Modal
        transparent
        animationType="slide"
        visible={swapState !== "closed"}
        statusBarTranslucent
        onRequestClose={() => setSwapState("closed")}
      >
        <Pressable style={styles.exerciseInfoBackdrop} onPress={() => setSwapState("closed")}>
          <Pressable style={styles.exerciseInfoPanel} onPress={(event) => event.stopPropagation()}>
            <View style={styles.exerciseInfoHandle} />
            <View style={styles.exerciseInfoPanelHeader}>
              <View style={styles.exerciseInfoPanelTitleWrap}>
                <Text style={styles.exerciseInfoPanelEyebrow}>SWAP EXERCISE</Text>
                <Text style={styles.exerciseInfoPanelTitle}>Same muscle, different move</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close swap exercise"
                onPress={() => setSwapState("closed")}
                style={styles.exerciseInfoClose}
              >
                <Text style={styles.exerciseInfoCloseText}>×</Text>
              </Pressable>
            </View>

            {swapState === "closed" ? null : swapState === "loading" ? (
              <Text style={styles.swapLoadingText}>Finding alternatives…</Text>
            ) : swapState.options.length === 0 ? (
              <Text style={styles.swapLoadingText}>No alternatives found for this exercise right now.</Text>
            ) : (
              swapState.options.map((option) => (
                <Pressable
                  key={option.name}
                  accessibilityRole="button"
                  accessibilityLabel={`Swap in ${option.name}`}
                  onPress={() => applySwap(option)}
                  style={({ pressed }) => [styles.swapOptionRow, pressed && { opacity: 0.8 }]}
                >
                  <Image source={option.formFrames[0]} style={styles.swapOptionThumb} resizeMode="cover" />
                  <View style={styles.swapOptionCopy}>
                    <Text style={styles.swapOptionName}>{option.name}</Text>
                    <Text style={styles.swapOptionTarget}>{option.target}</Text>
                  </View>
                  <Text style={styles.cardChevron}>›</Text>
                </Pressable>
              ))
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

function ProgressScreen({
  onDashboard,
  onStartWorkout,
  onOpenNutrition,
  onOpenCoach,
  profile,
  workoutHistory,
}: {
  onDashboard: () => void;
  onStartWorkout: () => void;
  onOpenNutrition: () => void;
  onOpenCoach: () => void;
  profile: Record<string, string>;
  workoutHistory: WorkoutHistoryEntry[];
}) {
  const nextFocus =
    profile.goal === "strength"
      ? "Progressive load"
      : profile.goal === "fat-loss"
        ? "Training density"
        : "Movement quality";

  const totalWorkouts = workoutHistory.length;
  const hasHistory = totalWorkouts > 0;
  const thisWeekCount = workoutHistory.filter((entry) => isWithinLastDays(entry.date, 7)).length;
  const totalSets = workoutHistory.reduce((sum, entry) => sum + entry.sets, 0);
  const totalSeconds = workoutHistory.reduce((sum, entry) => sum + entry.seconds, 0);

  return (
    <SafeAreaView style={styles.progressScreen}>
      <ScrollView
        style={styles.progressScroll}
        contentContainerStyle={styles.progressContent}
        showsVerticalScrollIndicator={false}
      >
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

        <Text style={styles.progressEyebrow}>{hasHistory ? "YOUR TRAINING HISTORY" : "FOUNDATION WEEK"}</Text>
        <Text style={styles.progressTitle}>
          {hasHistory ? "You’re building consistency." : "Your baseline is set."}
        </Text>
        <Text style={styles.progressSubtitle}>
          {hasHistory
            ? "Every completed workout adjusts your plan’s load and volume."
            : "Complete your first workout to start tracking real progress here."}
        </Text>

        <View style={styles.progressHero}>
          <View>
            <Text style={styles.progressScoreValue}>{totalWorkouts}</Text>
            <Text style={styles.progressScoreLabel}>WORKOUTS COMPLETED</Text>
          </View>
          <View style={styles.progressHeroBadge}>
            <Text style={styles.progressHeroBadgeValue}>{thisWeekCount}</Text>
            <Text style={styles.progressHeroBadgeLabel}>THIS WEEK</Text>
          </View>
        </View>

        <View style={styles.progressMetrics}>
          <View style={styles.progressMetric}>
            <Text style={styles.progressMetricValue}>{totalSets}</Text>
            <Text style={styles.progressMetricLabel}>TOTAL SETS</Text>
          </View>
          <View style={styles.progressMetricDivider} />
          <View style={styles.progressMetric}>
            <Text style={styles.progressMetricValue}>{formatHistoryDuration(totalSeconds)}</Text>
            <Text style={styles.progressMetricLabel}>TOTAL TIME</Text>
          </View>
          <View style={styles.progressMetricDivider} />
          <View style={styles.progressMetric}>
            <Text style={styles.progressMetricValue}>
              {hasHistory ? formatHistoryDuration(Math.round(totalSeconds / totalWorkouts)) : "–"}
            </Text>
            <Text style={styles.progressMetricLabel}>AVG SESSION</Text>
          </View>
        </View>

        <View style={styles.progressSection}>
          <Text style={styles.progressSectionTitle}>RECENT WORKOUTS</Text>
          {hasHistory ? (
            workoutHistory.slice(0, 10).map((entry) => (
              <View key={entry.id} style={styles.historyRow}>
                <View style={styles.historyDateChip}>
                  <Text style={styles.historyDateText}>{formatHistoryDate(entry.date)}</Text>
                </View>
                <View style={styles.historyRowCopy}>
                  <Text style={styles.historyTitleText} numberOfLines={1}>
                    {entry.title}
                  </Text>
                  <Text style={styles.historyMetaText}>
                    {entry.exercises} exercises · {entry.sets} sets · {formatHistoryDuration(entry.seconds)}
                  </Text>
                </View>
                <Text style={styles.historyCaloriesText}>{entry.calories} kcal</Text>
              </View>
            ))
          ) : (
            <Text style={styles.progressEmptyText}>No workouts logged yet — finish one to see it here.</Text>
          )}

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
              {hasHistory
                ? `You’ve logged ${totalWorkouts} session${totalWorkouts === 1 ? "" : "s"} so far. Keep the frequency steady and we’ll keep adjusting load and volume from here.`
                : "Baseline established. Your next session will adjust load, exercise selection, and tempo from today’s result."}
            </Text>
          </View>
        </View>
      </ScrollView>

      <BottomNav
        active="progress"
        onHome={onDashboard}
        onNutrition={onOpenNutrition}
        onProgress={() => {}}
        onCoach={onOpenCoach}
      />
    </SafeAreaView>
  );
}

function isMediumPassword(password: string): boolean {
  return password.length >= 8 && /[a-zA-Z]/.test(password) && /[0-9]/.test(password);
}

function AuthScreen({
  onBack,
  onSuccess,
  initialMode = "signup",
}: {
  onBack: () => void;
  onSuccess: () => void;
  initialMode?: "signup" | "login";
}) {
  const [mode, setMode] = useState<"signup" | "login" | "forgot">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  const submit = async () => {
    if (isSubmitting) return;
    setError("");
    const trimmedEmail = email.trim().toLowerCase();

    if (mode === "forgot") {
      setIsSubmitting(true);
      try {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(
          trimmedEmail,
          Platform.OS === "web" ? { redirectTo: `${window.location.origin}/reset-password` } : undefined,
        );
        if (authError) throw new Error(authError.message);
        setResetSent(true);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (mode === "signup" && !isMediumPassword(password)) {
      setError("Password must be at least 8 characters and include both letters and numbers.");
      return;
    }
    setIsSubmitting(true);
    try {
      const { error: authError } =
        mode === "signup"
          ? await supabase.auth.signUp({ email: trimmedEmail, password })
          : await supabase.auth.signInWithPassword({ email: trimmedEmail, password });
      if (authError) throw new Error(authError.message);
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const continueWithFacebook = async () => {
    setError("");
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "facebook",
      options: Platform.OS === "web" ? { redirectTo: window.location.origin } : undefined,
    });
    if (authError) setError(authError.message);
  };

  const continueWithGoogle = async () => {
    setError("");
    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: Platform.OS === "web" ? { redirectTo: window.location.origin } : undefined,
    });
    if (authError) setError(authError.message);
  };

  return (
    <SafeAreaView style={styles.recipesScreen}>
      <View style={styles.nutritionHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} style={styles.coachBack}>
          <Text style={styles.coachBackText}>‹</Text>
        </Pressable>
        <View>
          <Text style={styles.nutritionHeaderTitle}>ACCOUNT</Text>
          <Text style={styles.nutritionHeaderSubtitle}>
            {mode === "signup" ? "Create your account" : mode === "login" ? "Welcome back" : "Reset your password"}
          </Text>
        </View>
        <View style={styles.coachHeaderSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.nutritionContent} showsVerticalScrollIndicator={false}>
        <View style={styles.nutritionIntro}>
          <Text style={styles.nutritionEyebrow}>SAVE YOUR PROGRESS</Text>
          <Text style={styles.nutritionTitle}>
            {mode === "signup" ? "Create an account." : mode === "login" ? "Log back in." : "Forgot password."}
          </Text>
          <Text style={styles.nutritionSubtitle}>
            {mode === "forgot"
              ? "Enter your email and we'll send you a link to set a new password."
              : "Keep your plan, progress, and history synced across devices."}
          </Text>
        </View>

        {mode === "forgot" && resetSent ? (
          <Text style={styles.nutritionSubtitle}>
            If an account exists for {email.trim() || "that email"}, a reset link is on its way. Check your inbox.
          </Text>
        ) : (
          <>
            <Text style={styles.dietGroupLabel}>EMAIL</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              placeholderTextColor="#5B6058"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              style={styles.dietAvoidInput}
            />

            {mode !== "forgot" ? (
              <>
                <Text style={styles.dietGroupLabel}>PASSWORD</Text>
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  placeholder={mode === "signup" ? "8+ characters, letters & numbers" : "Your password"}
                  placeholderTextColor="#5B6058"
                  secureTextEntry
                  style={styles.dietAvoidInput}
                />
              </>
            ) : null}

            {mode === "login" ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Forgot password?"
                onPress={() => {
                  setMode("forgot");
                  setError("");
                  setResetSent(false);
                }}
                style={styles.authSwitchLink}
              >
                <Text style={styles.authSwitchLinkText}>Forgot password?</Text>
              </Pressable>
            ) : null}

            {error ? <Text style={[styles.nutritionError, { marginTop: 14 }]}>{error}</Text> : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={mode === "signup" ? "Create account" : mode === "login" ? "Log in" : "Send reset link"}
              onPress={submit}
              disabled={isSubmitting}
              style={[styles.dietBuildButton, isSubmitting && styles.dietBuildButtonDisabled]}
            >
              <Text style={styles.dietBuildButtonText}>
                {isSubmitting
                  ? "PLEASE WAIT…"
                  : mode === "signup"
                    ? "CREATE ACCOUNT"
                    : mode === "login"
                      ? "LOG IN"
                      : "SEND RESET LINK"}
              </Text>
            </Pressable>

            {mode !== "forgot" ? (
              <>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Continue with Google"
                  onPress={continueWithGoogle}
                  style={[styles.dietRebuildButton, { marginTop: 10 }]}
                >
                  <Text style={styles.dietRebuildButtonText}>CONTINUE WITH GOOGLE</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Continue with Facebook"
                  onPress={continueWithFacebook}
                  style={[styles.dietRebuildButton, { marginTop: 10 }]}
                >
                  <Text style={styles.dietRebuildButtonText}>CONTINUE WITH FACEBOOK</Text>
                </Pressable>
              </>
            ) : null}
          </>
        )}

        {mode === "forgot" ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Back to log in"
            onPress={() => {
              setMode("login");
              setError("");
              setResetSent(false);
            }}
            style={[styles.authSwitchLink, { marginTop: 16 }]}
          >
            <Text style={styles.authSwitchLinkText}>Back to log in</Text>
          </Pressable>
        ) : (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={mode === "signup" ? "Already have an account? Log in" : "Need an account? Sign up"}
            onPress={() => {
              setMode((current) => (current === "signup" ? "login" : "signup"));
              setError("");
            }}
            style={styles.authSwitchLink}
          >
            <Text style={styles.authSwitchLinkText}>
              {mode === "signup" ? "Already have an account? Log in" : "Need an account? Sign up"}
            </Text>
          </Pressable>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function ResetPasswordScreen({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const submit = async () => {
    if (isSubmitting) return;
    setError("");
    if (!isMediumPassword(password)) {
      setError("Password must be at least 8 characters and include both letters and numbers.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setIsSubmitting(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({ password });
      if (authError) throw new Error(authError.message);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.recipesScreen}>
      <View style={styles.nutritionHeader}>
        <View style={styles.coachHeaderSpacer} />
        <View>
          <Text style={styles.nutritionHeaderTitle}>ACCOUNT</Text>
          <Text style={styles.nutritionHeaderSubtitle}>Set a new password</Text>
        </View>
        <View style={styles.coachHeaderSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.nutritionContent} showsVerticalScrollIndicator={false}>
        <View style={styles.nutritionIntro}>
          <Text style={styles.nutritionEyebrow}>RESET PASSWORD</Text>
          <Text style={styles.nutritionTitle}>{done ? "Password updated." : "Choose a new password."}</Text>
          <Text style={styles.nutritionSubtitle}>
            {done
              ? "You can now continue with your new password."
              : "Must be at least 8 characters and include both letters and numbers."}
          </Text>
        </View>

        {done ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Continue" onPress={onDone} style={styles.dietBuildButton}>
            <Text style={styles.dietBuildButtonText}>CONTINUE</Text>
          </Pressable>
        ) : (
          <>
            <Text style={styles.dietGroupLabel}>NEW PASSWORD</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="8+ characters, letters & numbers"
              placeholderTextColor="#5B6058"
              secureTextEntry
              style={styles.dietAvoidInput}
            />

            <Text style={styles.dietGroupLabel}>CONFIRM PASSWORD</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              placeholder="Re-enter your new password"
              placeholderTextColor="#5B6058"
              secureTextEntry
              style={styles.dietAvoidInput}
            />

            {error ? <Text style={[styles.nutritionError, { marginTop: 14 }]}>{error}</Text> : null}

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Save new password"
              onPress={submit}
              disabled={isSubmitting}
              style={[styles.dietBuildButton, isSubmitting && styles.dietBuildButtonDisabled]}
            >
              <Text style={styles.dietBuildButtonText}>{isSubmitting ? "PLEASE WAIT…" : "SAVE NEW PASSWORD"}</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

export default function App() {
  const [screen, setScreen] = useState<Screen>(() =>
    Platform.OS === "web" && window.location.pathname === "/reset-password" ? "resetPassword" : "splash",
  );
  const [profile, setProfile] = useState<Record<string, string>>({});
  const [coachAdjustment, setCoachAdjustment] = useState<CoachScenario | null>(null);
  const [coachMessages, setCoachMessages] = useState<CoachMessage[]>([]);
  const [selectedLibraryRecipeId, setSelectedLibraryRecipeId] = useState<string | null>(null);
  const [hasLoadedTestState, setHasLoadedTestState] = useState(false);
  const [nutritionTotals, setNutritionTotals] = useState<NutritionTotals>({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });
  const [exerciseProgress, setExerciseProgress] = useState<Record<string, ExerciseProgress>>({});
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutHistoryEntry[]>([]);
  const [dietPlan, setDietPlan] = useState<SavedDietPlan | null>(null);
  const [session, setSession] = useState<{ email: string } | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [trialStartedAt, setTrialStartedAt] = useState<string | null>(null);
  const [authInitialMode, setAuthInitialMode] = useState<"signup" | "login">("signup");
  const [authOrigin, setAuthOrigin] = useState<"welcome" | "dashboard">("dashboard");
  const [activeWorkoutExercises, setActiveWorkoutExercises] = useState<WorkoutExercise[] | null>(null);
  const [activeWorkoutSplitLabel, setActiveWorkoutSplitLabel] = useState<string | null>(null);
  const [activeWorkoutSplitDay, setActiveWorkoutSplitDay] = useState<SplitDay | null>(null);
  const [activeWorkoutIsDeload, setActiveWorkoutIsDeload] = useState(false);
  const [activeWorkoutWeightModifier, setActiveWorkoutWeightModifier] = useState(1);
  const [workoutLoading, setWorkoutLoading] = useState(false);
  const [tooSoonWarningOpen, setTooSoonWarningOpen] = useState(false);

  const startWorkout = async () => {
    const hoursSince = hoursSinceLastWorkout(workoutHistory);
    if (hoursSince !== null && hoursSince < 8) {
      setTooSoonWarningOpen(true);
      return;
    }
    await beginWorkout();
  };

  const beginWorkout = async () => {
    setTooSoonWarningOpen(false);
    setWorkoutLoading(true);
    const result = await createWorkoutFromCatalog(profile, exerciseProgress, workoutHistory, coachAdjustment);
    setActiveWorkoutExercises(result?.exercises ?? null);
    setActiveWorkoutSplitLabel(result?.splitLabel ?? null);
    setActiveWorkoutSplitDay(result?.splitDay ?? null);
    setActiveWorkoutIsDeload(result?.isDeload ?? false);
    setActiveWorkoutWeightModifier(result?.weightModifier ?? 1);
    setWorkoutLoading(false);
    setScreen("workout");
  };

  const stateRef = useRef({
    profile,
    nutritionTotals,
    coachAdjustment,
    coachMessages,
    exerciseProgress,
    workoutHistory,
    dietPlan,
  });
  stateRef.current = {
    profile,
    nutritionTotals,
    coachAdjustment,
    coachMessages,
    exerciseProgress,
    workoutHistory,
    dietPlan,
  };

  useEffect(() => {
    if (Platform.OS !== "web" || !isSupabaseConfigured) {
      setHasLoadedTestState(true);
      return;
    }
    let cancelled = false;
    let initialHandled = false;

    const finishInitialLoad = () => {
      if (initialHandled) return;
      initialHandled = true;
      setHasLoadedTestState(true);
    };

    const loadLocalState = () => {
      try {
        const savedState = window.localStorage.getItem("project-g-test-state");
        if (savedState) {
          const parsed = JSON.parse(savedState) as {
            profile?: Record<string, string>;
            nutritionTotals?: NutritionTotals;
            coachAdjustment?: CoachScenario | null;
            coachMessages?: CoachMessage[];
            exerciseProgress?: Record<string, ExerciseProgress>;
            workoutHistory?: WorkoutHistoryEntry[];
            dietPlan?: SavedDietPlan | null;
          };
          if (parsed.profile && Object.keys(parsed.profile).length > 0) {
            setProfile(parsed.profile);
            setNutritionTotals(parsed.nutritionTotals ?? { calories: 0, protein: 0, carbs: 0, fat: 0 });
            setCoachAdjustment(parsed.coachAdjustment ?? null);
            setCoachMessages(parsed.coachMessages ?? []);
            setExerciseProgress(parsed.exerciseProgress ?? {});
            setWorkoutHistory(parsed.workoutHistory ?? []);
            setDietPlan(parsed.dietPlan ?? null);
            setScreen("dashboard");
          }
        }
      } catch {
        window.localStorage.removeItem("project-g-test-state");
      }
    };

    const applySession = async (id: string, email: string | undefined) => {
      try {
        const { data } = await supabase
          .from("user_data")
          .select(
            "profile, nutrition_totals, coach_adjustment, coach_messages, exercise_progress, workout_history, diet_plan, trial_started_at",
          )
          .eq("user_id", id)
          .maybeSingle();
        const remoteProfile = (data?.profile ?? {}) as Record<string, string>;
        setTrialStartedAt((data?.trial_started_at as string | undefined) ?? null);
        if (Object.keys(remoteProfile).length > 0) {
          setProfile(remoteProfile);
          setNutritionTotals(
            (data?.nutrition_totals as NutritionTotals) ?? { calories: 0, protein: 0, carbs: 0, fat: 0 },
          );
          setCoachAdjustment((data?.coach_adjustment as CoachScenario | null) ?? null);
          setCoachMessages((data?.coach_messages as CoachMessage[]) ?? []);
          setExerciseProgress((data?.exercise_progress as Record<string, ExerciseProgress>) ?? {});
          setWorkoutHistory((data?.workout_history as WorkoutHistoryEntry[]) ?? []);
          setDietPlan((data?.diet_plan as SavedDietPlan | null) ?? null);
          setScreen("dashboard");
        } else if (Object.keys(stateRef.current.profile).length > 0) {
          // Fresh account with no saved data yet: migrate whatever local/guest
          // progress already existed into it. Upsert (not update) so this still
          // works even if the on-signup trigger hasn't created the row yet.
          const { error: migrateError } = await supabase.from("user_data").upsert({
            user_id: id,
            profile: stateRef.current.profile,
            nutrition_totals: stateRef.current.nutritionTotals,
            coach_adjustment: stateRef.current.coachAdjustment,
            coach_messages: stateRef.current.coachMessages,
            exercise_progress: stateRef.current.exerciseProgress,
            workout_history: stateRef.current.workoutHistory,
            diet_plan: stateRef.current.dietPlan,
          });
          if (migrateError) console.error("Failed to migrate guest progress to account", migrateError);
        }
        if (Platform.OS === "web") window.localStorage.removeItem("project-g-test-state");
        setUserId(id);
        setSession({ email: email ?? "" });
      } catch {
        // Keep whatever local state was already present.
      } finally {
        finishInitialLoad();
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (cancelled) return;
      if (event === "SIGNED_OUT") {
        setSession(null);
        setUserId(null);
        setTrialStartedAt(null);
        finishInitialLoad();
        return;
      }
      if (event === "PASSWORD_RECOVERY") {
        // Supabase's reset-password link doesn't reliably land on our
        // /reset-password path, so react to the event itself instead.
        setScreen("resetPassword");
        finishInitialLoad();
        return;
      }
      if (newSession?.user) {
        void applySession(newSession.user.id, newSession.user.email);
      } else {
        loadLocalState();
        finishInitialLoad();
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedTestState || Platform.OS !== "web" || session || Object.keys(profile).length === 0) return;
    window.localStorage.setItem(
      "project-g-test-state",
      JSON.stringify({
        profile,
        nutritionTotals,
        coachAdjustment,
        coachMessages,
        exerciseProgress,
        workoutHistory,
        dietPlan,
      }),
    );
  }, [
    coachAdjustment,
    coachMessages,
    dietPlan,
    exerciseProgress,
    hasLoadedTestState,
    nutritionTotals,
    profile,
    session,
    workoutHistory,
  ]);

  useEffect(() => {
    if (!userId || !hasLoadedTestState) return;
    let cancelled = false;
    void (async () => {
      if (cancelled) return;
      const { error } = await supabase.from("user_data").upsert({
        user_id: userId,
        profile,
        nutrition_totals: nutritionTotals,
        coach_adjustment: coachAdjustment,
        coach_messages: coachMessages,
        exercise_progress: exerciseProgress,
        workout_history: workoutHistory,
        diet_plan: dietPlan,
      });
      if (error) console.error("Failed to sync progress to account", error);
    })();
    return () => {
      cancelled = true;
    };
  }, [
    coachAdjustment,
    coachMessages,
    dietPlan,
    exerciseProgress,
    hasLoadedTestState,
    nutritionTotals,
    profile,
    userId,
    workoutHistory,
  ]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUserId(null);
    setScreen("dashboard");
  };

  if (!hasLoadedTestState) return <View style={styles.app} />;

  if (workoutLoading) {
    return (
      <View style={[styles.app, styles.workoutLoadingScreen]}>
        <Text style={styles.workoutLoadingText}>Building your workout…</Text>
      </View>
    );
  }

  return (
    <View style={styles.app}>
      {Platform.OS === "android" ? <StatusBar backgroundColor={colors.background} /> : null}
      <ExpoStatusBar style="light" />
      <View style={styles.mobileViewport}>
        {screen === "splash" && <SplashScreen onComplete={() => setScreen("welcome")} />}
        {screen === "welcome" && (
          <WelcomeScreen
            onSignIn={() => {
              setAuthInitialMode("login");
              setAuthOrigin("welcome");
              setScreen("auth");
            }}
            onCreateAccount={() => {
              setAuthInitialMode("signup");
              setAuthOrigin("welcome");
              setScreen("auth");
            }}
          />
        )}
        {screen === "interview" && (
          <InterviewScreen
            onBack={() => setScreen("welcome")}
            onFinish={(answers) => {
              setProfile(answers);
              setScreen("dashboard");
            }}
            onStartWorkout={async (answers) => {
              setProfile(answers);
              setWorkoutLoading(true);
              const result = await createWorkoutFromCatalog(answers, exerciseProgress, workoutHistory, coachAdjustment);
              setActiveWorkoutExercises(result?.exercises ?? null);
              setActiveWorkoutSplitLabel(result?.splitLabel ?? null);
              setActiveWorkoutSplitDay(result?.splitDay ?? null);
              setActiveWorkoutIsDeload(result?.isDeload ?? false);
              setActiveWorkoutWeightModifier(result?.weightModifier ?? 1);
              setWorkoutLoading(false);
              setScreen("workout");
            }}
          />
        )}
        {screen === "dashboard" && (
          <DashboardScreen
            profile={profile}
            nutritionTotals={nutritionTotals}
            workoutHistory={workoutHistory}
            onStartWorkout={startWorkout}
            onOpenCoach={() => setScreen("coach")}
            onOpenNutrition={() => setScreen("nutrition")}
            onOpenProgress={() => setScreen("progress")}
            session={session}
            onOpenAccount={(mode) => {
              setAuthInitialMode(mode);
              setAuthOrigin("dashboard");
              setScreen("auth");
            }}
            onLogout={handleLogout}
            onOpenProfile={() => setScreen("profile")}
            trialDaysLeft={trialDaysRemaining(trialStartedAt)}
          />
        )}
        {screen === "profile" && (
          <ProfileScreen
            profile={profile}
            onUpdateProfile={(id, value) => setProfile((current) => ({ ...current, [id]: value }))}
            onBack={() => setScreen("dashboard")}
            session={session}
            onOpenAccount={(mode) => {
              setAuthInitialMode(mode);
              setAuthOrigin("dashboard");
              setScreen("auth");
            }}
            onLogout={handleLogout}
            trialDaysLeft={trialDaysRemaining(trialStartedAt)}
            trialEndsAtLabel={trialEndDateLabel(trialStartedAt)}
          />
        )}
        {screen === "auth" && (
          <AuthScreen
            initialMode={authInitialMode}
            onBack={() => setScreen(authOrigin)}
            onSuccess={() => setScreen(authOrigin === "welcome" ? "interview" : "dashboard")}
          />
        )}
        {screen === "resetPassword" && (
          <ResetPasswordScreen
            onDone={() => {
              if (Platform.OS === "web") window.history.replaceState({}, "", "/");
              setScreen("dashboard");
            }}
          />
        )}
        {screen === "nutrition" && (
          <NutritionScreen
            profile={profile}
            nutritionTotals={nutritionTotals}
            onUpdateProfile={(id, value) => setProfile((current) => ({ ...current, [id]: value }))}
            onBack={() => setScreen("dashboard")}
            onOpenRecipes={() => setScreen("recipes")}
            onOpenRecipeLibrary={() => setScreen("recipeLibrary")}
            onOpenDietPlan={() => setScreen("dietPlan")}
            onStartWorkout={startWorkout}
            onOpenProgress={() => setScreen("progress")}
            onOpenCoach={() => setScreen("coach")}
            onSave={(meal) =>
              setNutritionTotals((current) => ({
                calories: current.calories + meal.calories,
                protein: current.protein + meal.protein,
                carbs: current.carbs + meal.carbs,
                fat: current.fat + meal.fat,
              }))
            }
          />
        )}
        {screen === "recipes" && (
          <RecipesScreen
            profile={profile}
            nutritionTotals={nutritionTotals}
            onBack={() => setScreen("nutrition")}
          />
        )}
        {screen === "recipeLibrary" && (
          <RecipeLibraryScreen
            onBack={() => setScreen("nutrition")}
            onSelectRecipe={(recipeId) => {
              setSelectedLibraryRecipeId(recipeId);
              setScreen("recipeDetail");
            }}
          />
        )}
        {screen === "recipeDetail" && (
          <RecipeLibraryDetailScreen
            recipe={recipeLibrary.find((recipe) => recipe.id === selectedLibraryRecipeId) ?? recipeLibrary[0]!}
            onBack={() => setScreen("recipeLibrary")}
          />
        )}
        {screen === "dietPlan" && (
          <DietPlanScreen
            profile={profile}
            onBack={() => setScreen("nutrition")}
            savedPlan={dietPlan}
            onSave={setDietPlan}
          />
        )}
        {screen === "coach" && (
          <AICoachScreen
            profile={profile}
            workoutHistory={workoutHistory}
            exerciseProgress={exerciseProgress}
            messages={coachMessages}
            onMessagesChange={setCoachMessages}
            onBack={() => setScreen("dashboard")}
            onApply={setCoachAdjustment}
            onStartWorkout={startWorkout}
            onOpenDietPlan={() => setScreen("dietPlan")}
          />
        )}
        {screen === "workout" && (
          <ActiveWorkoutScreen
            exercises={activeWorkoutExercises ?? createWorkout(profile, exerciseProgress)}
            splitLabel={activeWorkoutSplitLabel}
            splitDay={activeWorkoutSplitDay}
            isDeload={activeWorkoutIsDeload}
            weightModifier={activeWorkoutWeightModifier}
            adjustment={coachAdjustment}
            profile={profile}
            exerciseProgress={exerciseProgress}
            onUpdateExerciseProgress={(name, next) =>
              setExerciseProgress((current) => ({ ...current, [name]: next }))
            }
            onCompleteWorkout={(entry) => setWorkoutHistory((current) => [entry, ...current])}
            onExit={() => setScreen("dashboard")}
            onViewProgress={() => setScreen("progress")}
          />
        )}
        {screen === "progress" && (
          <ProgressScreen
            profile={profile}
            workoutHistory={workoutHistory}
            onDashboard={() => setScreen("dashboard")}
            onStartWorkout={startWorkout}
            onOpenNutrition={() => setScreen("nutrition")}
            onOpenCoach={() => setScreen("coach")}
          />
        )}
      </View>

      <Modal
        transparent
        animationType="fade"
        visible={tooSoonWarningOpen}
        statusBarTranslucent
        onRequestClose={() => setTooSoonWarningOpen(false)}
      >
        <Pressable style={styles.exerciseInfoBackdrop} onPress={() => setTooSoonWarningOpen(false)}>
          <Pressable style={styles.tooSoonCard} onPress={(event) => event.stopPropagation()}>
            <Text style={styles.tooSoonTitle}>Already trained today?</Text>
            <Text style={styles.tooSoonBody}>
              You logged a workout less than 8 hours ago. Your body needs time to recover — start another session
              anyway?
            </Text>
            <Pressable onPress={beginWorkout} style={styles.exerciseInfoDone}>
              <Text style={styles.exerciseInfoDoneText}>START ANYWAY</Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Cancel"
              onPress={() => setTooSoonWarningOpen(false)}
            >
              <Text style={styles.mismatchBackText}>Cancel</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  app: {
    flex: 1,
    alignItems: "center",
    backgroundColor: "#020302",
  },
  workoutLoadingScreen: {
    justifyContent: "center",
  },
  workoutLoadingText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600",
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
  welcomeScrollContent: {},
  welcomeContent: {
    paddingHorizontal: 24,
    paddingTop: 16,
    paddingBottom: 18,
    backgroundColor: "rgba(0,0,0,0.86)",
  },
  eyebrow: {
    color: colors.lime,
    fontSize: 19,
    lineHeight: 22,
    fontWeight: "900",
    letterSpacing: 1.25,
    marginBottom: 12,
    textShadowColor: "rgba(190,255,40,0.24)",
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 14,
  },
  welcomeTitle: {
    maxWidth: 520,
    color: colors.text,
    fontSize: 38,
    lineHeight: 40,
    letterSpacing: -1.8,
    fontWeight: "700",
  },
  welcomeTitleAccent: { color: colors.lime },
  welcomeBody: {
    color: "#C7CBC4",
    maxWidth: 390,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 14,
    marginBottom: 18,
  },
  startButton: {
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.lime,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  startButtonPressed: { opacity: 0.82, transform: [{ scale: 0.99 }] },
  startButtonText: { color: colors.ink, fontSize: 13, fontWeight: "900", letterSpacing: 1.35 },
  startArrow: { color: colors.ink, fontSize: 23, fontWeight: "500" },
  disclaimer: { color: "#7D827A", fontSize: 10, textAlign: "center", marginTop: 10 },
  welcomeAuthRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    marginTop: 16,
  },
  welcomeAuthLabel: { color: "#7D827A", fontSize: 12, fontWeight: "600" },
  welcomeAuthLinkText: { color: colors.text, fontSize: 12, fontWeight: "700" },
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
  scheduleDaysRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 14 },
  scheduleDayChip: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#353A34",
  },
  scheduleDayChipSelected: { backgroundColor: colors.lime, borderColor: colors.lime },
  scheduleDayChipText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  scheduleDayChipTextSelected: { color: colors.ink },
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
  wheelPickerWrap: { marginTop: 24, alignItems: "center" },
  wheelPicker: {
    width: "100%",
    maxWidth: 280,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#262A24",
    backgroundColor: "#0C0E0C",
    overflow: "hidden",
  },
  wheelPickerHighlight: {
    position: "absolute",
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: "rgba(200,255,50,0.35)",
    backgroundColor: "rgba(200,255,50,0.06)",
  },
  wheelPickerRow: { height: WHEEL_ITEM_HEIGHT, alignItems: "center", justifyContent: "center" },
  wheelPickerText: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "600",
    lineHeight: WHEEL_ITEM_HEIGHT,
  },
  wheelPickerTextSelected: { fontWeight: "800" },
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
    paddingBottom: 9,
  },
  dashboardGreeting: { color: colors.muted, fontSize: 8, fontWeight: "800", letterSpacing: 1.6 },
  dashboardName: { color: colors.text, fontSize: 22, fontWeight: "700", letterSpacing: -0.7, marginTop: 4 },
  dashboardAvatarChevron: { color: colors.muted, fontSize: 16 },
  myProfilePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 12,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#353A31",
    backgroundColor: "#131612",
  },
  myProfilePillText: { color: colors.text, fontSize: 10, fontWeight: "900", letterSpacing: 0.6 },
  avatarStatus: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.lime,
  },
  dashboardBody: { flex: 1 },
  dashboardBodyContent: { paddingHorizontal: 18, paddingBottom: 10 },
  profileList: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#242824",
    backgroundColor: "#0E100E",
    marginTop: 10,
    overflow: "hidden",
  },
  profileRow: {
    minHeight: 52,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#1B1E1A",
  },
  profileRowLabel: { color: colors.text, fontSize: 13, fontWeight: "600", flexShrink: 1, marginRight: 10 },
  profileRowRight: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 0 },
  profileRowValue: { color: colors.muted, fontSize: 12, fontWeight: "600", maxWidth: 140 },
  testModeIdentity: { flexDirection: "row", alignItems: "center" },
  testModeDot: { width: 7, height: 7, borderRadius: 4, marginRight: 8, backgroundColor: colors.lime },
  testModeLabel: { color: colors.lime, fontSize: 12, fontWeight: "900", letterSpacing: 0.7 },
  testModeReset: { minHeight: 34, paddingHorizontal: 10, alignItems: "center", justifyContent: "center" },
  testModeResetText: { color: "#B6BDB2", fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
  accountBar: {
    minHeight: 46,
    marginBottom: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    borderWidth: 1,
    borderColor: "#242824",
    backgroundColor: "#0E100E",
  },
  accountPromptText: { color: colors.muted, fontSize: 13, fontWeight: "700", flexShrink: 1 },
  accountActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  accountButton: {
    minHeight: 32,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: colors.lime,
    alignItems: "center",
    justifyContent: "center",
  },
  accountButtonText: { color: colors.ink, fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
  trialBar: {
    paddingVertical: 8,
    marginBottom: 10,
    paddingHorizontal: 14,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#30382A",
    backgroundColor: "#0D1209",
  },
  trialBarEnded: { borderColor: "#3A2A22", backgroundColor: "#160F0B" },
  trialBarText: { color: colors.lime, fontSize: 13, fontWeight: "900", letterSpacing: 0.6, lineHeight: 16 },
  trialBarTextEnded: { color: "#D98E5C" },
  readinessRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  readinessCard: {
    minHeight: 62,
    borderRadius: 18,
    paddingHorizontal: 13,
    marginBottom: 9,
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
    marginBottom: 6,
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
    padding: 13,
    marginBottom: 8,
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
    fontSize: 24,
    lineHeight: 26,
    fontWeight: "700",
    letterSpacing: -1.1,
    marginTop: 8,
  },
  workoutMeta: { color: colors.muted, fontSize: 11, marginTop: 4 },
  workoutCoachNote: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    paddingTop: 8,
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
    height: 42,
    borderRadius: 21,
    paddingHorizontal: 18,
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.lime,
  },
  workoutButtonText: { color: colors.ink, fontSize: 11, fontWeight: "900", letterSpacing: 1.1 },
  workoutButtonArrow: { color: colors.ink, fontSize: 19, fontWeight: "700" },
  metricGrid: { flexDirection: "row", gap: 8, marginBottom: 8 },
  metricCard: {
    flex: 1,
    minHeight: 58,
    borderRadius: 15,
    padding: 10,
    borderWidth: 1,
    borderColor: "#242824",
    backgroundColor: "#0D0F0D",
  },
  metricIcon: { color: colors.lime, fontSize: 13, marginBottom: 8 },
  metricValue: { color: colors.text, fontSize: 18, fontWeight: "800" },
  metricLabel: { color: colors.muted, fontSize: 7, fontWeight: "800", letterSpacing: 1.2, marginTop: 2 },
  metricTrend: { color: "#6F756C", fontSize: 8, marginTop: 7 },
  lastWorkoutCard: {
    minHeight: 50,
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
  lastWorkoutScoreText: { color: "#37C85A", fontSize: 10, fontWeight: "900", textAlign: "center" },
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
  navIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  navIconWrapActive: { backgroundColor: "rgba(200,255,50,0.16)" },
  navIcon: { fontSize: 18, lineHeight: 22 },
  navIconInactive: { opacity: 0.4 },
  navLabel: { color: colors.muted, fontSize: 9, fontWeight: "800", letterSpacing: 0.6, marginTop: 4 },
  navActive: { color: colors.lime },
  nutritionScreen: { flex: 1, backgroundColor: colors.background },
  nutritionScroll: { flex: 1 },
  nutritionHeader: {
    minHeight: 54,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#252925",
  },
  nutritionHeaderTitle: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1.5,
    textAlign: "center",
  },
  nutritionHeaderSubtitle: { color: colors.muted, fontSize: 8, marginTop: 2, textAlign: "center" },
  nutritionContent: {
    width: "100%",
    maxWidth: 520,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 20,
  },
  nutritionIntro: { marginBottom: 12 },
  nutritionEyebrow: { color: colors.lime, fontSize: 9, fontWeight: "900", letterSpacing: 1.6 },
  nutritionTitle: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 27,
    fontWeight: "900",
    letterSpacing: -0.9,
    marginTop: 4,
  },
  nutritionSubtitle: { color: colors.muted, fontSize: 11, lineHeight: 15, marginTop: 4 },
  dietModeRow: { flexDirection: "row", gap: 8, marginBottom: 8 },
  dietModePill: {
    flex: 1,
    minHeight: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#242824",
    backgroundColor: "#0E100E",
  },
  dietModePillActive: { borderColor: colors.lime, backgroundColor: colors.lime },
  dietModePillText: { color: colors.muted, fontSize: 11, fontWeight: "900", letterSpacing: 0.6 },
  dietModePillTextActive: { color: colors.ink },
  dietModeHint: { color: colors.muted, fontSize: 11, marginBottom: 14, textAlign: "center" },
  foodPhotoCard: {
    position: "relative",
    width: "100%",
    aspectRatio: 1.6,
    minHeight: 150,
    maxHeight: 220,
    borderRadius: 24,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#303630",
    backgroundColor: "#101310",
  },
  foodPhoto: { width: "100%", height: "100%" },
  foodPhotoEmpty: { flex: 1, alignItems: "center", justifyContent: "center" },
  foodPhotoIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    color: colors.ink,
    backgroundColor: colors.lime,
    fontSize: 26,
    lineHeight: 40,
    fontWeight: "300",
    textAlign: "center",
  },
  foodPhotoEmptyTitle: { color: colors.text, fontSize: 10, fontWeight: "900", letterSpacing: 1.2, marginTop: 10 },
  foodPhotoEmptyText: { color: colors.muted, fontSize: 9, marginTop: 4 },
  nutritionAnalyzeButton: {
    minHeight: 58,
    borderRadius: 29,
    marginTop: 14,
    paddingHorizontal: 22,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.lime,
  },
  nutritionAnalyzeButtonText: { color: colors.ink, fontSize: 10, fontWeight: "900", letterSpacing: 1.3 },
  nutritionAnalyzeArrow: { color: colors.ink, fontSize: 20, fontWeight: "700" },
  nutritionError: {
    color: "#FF9A82",
    fontSize: 10,
    lineHeight: 15,
    marginTop: 14,
    padding: 12,
    borderRadius: 12,
    backgroundColor: "rgba(255,90,65,0.1)",
  },
  nutritionResults: { marginTop: 22 },
  nutritionResultHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  nutritionResultTitle: { color: colors.lime, fontSize: 10, fontWeight: "900", letterSpacing: 1.5 },
  nutritionConfidence: { color: colors.muted, fontSize: 7, fontWeight: "800", letterSpacing: 0.8 },
  foodItemRow: {
    minHeight: 74,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
    borderRadius: 16,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#282D28",
    backgroundColor: "#0E110E",
  },
  foodItemCopy: { flex: 1, paddingRight: 8 },
  foodItemName: { color: colors.text, fontSize: 12, fontWeight: "800" },
  foodItemMacros: { color: colors.muted, fontSize: 7, lineHeight: 11, marginTop: 4 },
  portionControl: { flexDirection: "row", alignItems: "center" },
  portionButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#3A4138",
  },
  portionButtonText: { color: colors.lime, fontSize: 16, lineHeight: 18, fontWeight: "700" },
  portionValue: { minWidth: 48, color: colors.text, fontSize: 9, fontWeight: "800", textAlign: "center" },
  nutritionTotalCard: {
    marginTop: 6,
    padding: 18,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#557117",
    backgroundColor: "#121A08",
  },
  nutritionTotalLabel: { color: colors.lime, fontSize: 8, fontWeight: "900", letterSpacing: 1.4 },
  nutritionCalories: { color: colors.text, fontSize: 30, fontWeight: "900", marginTop: 5 },
  nutritionMacroRow: { flexDirection: "row", marginTop: 15 },
  nutritionMacro: { flex: 1 },
  nutritionMacroValue: { color: colors.text, fontSize: 14, fontWeight: "900" },
  nutritionMacroLabel: { color: colors.muted, fontSize: 7, fontWeight: "800", letterSpacing: 0.8, marginTop: 2 },
  nutritionNote: { color: "#7F867C", fontSize: 8, lineHeight: 12, marginTop: 12 },
  nutritionRefineSection: {
    marginTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#222622",
    paddingTop: 14,
  },
  nutritionRefineLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 10,
  },
  nutritionRefineComposer: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  nutritionSaveButton: {
    minHeight: 56,
    borderRadius: 28,
    marginTop: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lime,
  },
  nutritionSaveButtonDone: { backgroundColor: "#8EAE35" },
  nutritionSaveButtonText: { color: colors.ink, fontSize: 10, fontWeight: "900", letterSpacing: 1.3 },
  proteinGapCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(200,255,50,0.3)",
    backgroundColor: "rgba(200,255,50,0.07)",
    padding: 13,
    marginBottom: 12,
    gap: 9,
  },
  proteinGapCopy: { gap: 3 },
  proteinGapEyebrow: { color: colors.lime, fontSize: 9, fontWeight: "800", letterSpacing: 1.4 },
  proteinGapTitle: { color: colors.text, fontSize: 14, fontWeight: "700", lineHeight: 18 },
  proteinGapSubtitle: { color: colors.muted, fontSize: 10 },
  proteinGapButton: {
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.lime,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  proteinGapButtonText: { color: colors.ink, fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  proteinGapButtonArrow: { color: colors.ink, fontSize: 15, fontWeight: "900" },
  recipesScreen: { flex: 1, backgroundColor: colors.background },
  recipeLoading: { paddingVertical: 40, alignItems: "center" },
  recipeLoadingText: { color: colors.muted, fontSize: 13 },
  recipeCard: {
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#262A24",
    backgroundColor: "#0C0E0C",
    padding: 18,
    marginBottom: 14,
    gap: 10,
  },
  recipeCardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  recipeName: { color: colors.text, fontSize: 16, fontWeight: "800", flexShrink: 1, paddingRight: 8 },
  recipeMinutes: { color: colors.lime, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  recipeDescription: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  recipeIngredients: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  recipeIngredientPill: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#2A2F28",
    backgroundColor: "#141712",
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  recipeIngredientText: { color: "#CFD3CC", fontSize: 10, fontWeight: "600" },
  recipeMacroRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
  recipeMacroText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  recipeMacroTextHighlight: { color: colors.lime, fontSize: 11, fontWeight: "800" },
  recipeMacroDivider: { color: "#3A3F38", fontSize: 11 },
  recipeTapHint: { color: "#5B6058", fontSize: 8, fontWeight: "800", letterSpacing: 0.8 },
  dietGroupLabel: {
    color: colors.muted,
    fontSize: 9,
    fontWeight: "900",
    letterSpacing: 1.2,
    marginTop: 16,
    marginBottom: 8,
  },
  dietChipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  dietChip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#262A24",
    backgroundColor: "#0C0E0C",
    alignItems: "center",
    justifyContent: "center",
  },
  dietChipSelected: { borderColor: colors.lime, backgroundColor: "rgba(200,255,50,0.12)" },
  dietChipText: { color: "#CFD3CC", fontSize: 12, fontWeight: "700" },
  dietChipTextSelected: { color: colors.lime },
  dietAvoidInput: {
    height: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#262A24",
    backgroundColor: "#0C0E0C",
    paddingHorizontal: 14,
    color: colors.text,
    fontSize: 13,
  },
  dietBuildButton: {
    height: 51,
    borderRadius: 26,
    marginTop: 22,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.lime,
  },
  dietBuildButtonDisabled: { backgroundColor: "#171A17" },
  dietBuildButtonText: { color: colors.ink, fontSize: 11, fontWeight: "900", letterSpacing: 1.1 },
  dietBuildButtonArrow: { color: colors.ink, fontSize: 17, fontWeight: "700" },
  dietTotalsRow: {
    marginTop: 4,
    marginBottom: 20,
    paddingHorizontal: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dietTotalsLabel: { color: colors.muted, fontSize: 9, fontWeight: "900", letterSpacing: 1 },
  dietTotalsValue: { color: colors.text, fontSize: 11, fontWeight: "700" },
  dietDayHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 6,
    marginBottom: 4,
  },
  dietDayLabel: { color: colors.lime, fontSize: 11, fontWeight: "900", letterSpacing: 1.2 },
  dietTodayBadge: {
    backgroundColor: "rgba(200,255,50,0.16)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  dietTodayBadgeText: { color: colors.lime, fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
  dietCycleNote: {
    color: colors.muted,
    fontSize: 10,
    lineHeight: 15,
    marginBottom: 12,
  },
  dietRebuildButton: {
    height: 46,
    borderRadius: 23,
    borderWidth: 1,
    borderColor: "#2A2F28",
    alignItems: "center",
    justifyContent: "center",
  },
  dietRebuildButtonText: { color: colors.text, fontSize: 11, fontWeight: "800", letterSpacing: 1 },
  authSwitchLink: { marginTop: 16, alignItems: "center", justifyContent: "center", minHeight: 30 },
  authSwitchLinkText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  libraryEntryCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(200,255,50,0.3)",
    backgroundColor: "rgba(200,255,50,0.07)",
    padding: 11,
    marginBottom: 12,
    gap: 10,
  },
  libraryEntryIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lime,
  },
  libraryEntryIconText: { fontSize: 17 },
  libraryEntryCopy: { flex: 1 },
  libraryEntryEyebrow: { color: colors.lime, fontSize: 9, fontWeight: "800", letterSpacing: 1.2 },
  libraryEntryTitle: { color: colors.text, fontSize: 14, fontWeight: "800", marginTop: 2 },
  libraryEntrySubtitle: { color: colors.muted, fontSize: 10, marginTop: 1 },
  libraryEntryArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(200,255,50,0.15)",
  },
  libraryEntryArrowText: { color: colors.lime, fontSize: 16, fontWeight: "900" },
  libraryTabs: {
    flexDirection: "row",
    paddingHorizontal: 24,
    gap: 10,
    marginBottom: 14,
  },
  libraryTab: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#262A24",
    backgroundColor: "#0C0E0C",
    alignItems: "center",
    justifyContent: "center",
  },
  libraryTabActive: { borderColor: colors.lime, backgroundColor: "rgba(200,255,50,0.1)" },
  libraryTabText: { color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
  libraryTabTextActive: { color: colors.lime },
  libraryCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#262A24",
    backgroundColor: "#0C0E0C",
    padding: 10,
    marginBottom: 12,
    gap: 12,
  },
  libraryCardPhoto: { width: 64, height: 64, borderRadius: 12 },
  libraryCardBody: { flex: 1 },
  libraryCardName: { color: colors.text, fontSize: 14, fontWeight: "700" },
  libraryCardMeta: { color: colors.muted, fontSize: 10, fontWeight: "600", marginTop: 4 },
  recipeDetailContent: { paddingBottom: 40 },
  recipeDetailPhoto: { width: "100%", height: 220 },
  mealImagePlaceholder: { alignItems: "center", justifyContent: "center", backgroundColor: "#101210" },
  mealImagePlaceholderIcon: { fontSize: 32 },
  mealImagePlaceholderText: { color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  recipeDetailBody: { paddingHorizontal: 24, paddingTop: 20 },
  recipeDetailName: { color: colors.text, fontSize: 24, fontWeight: "800", letterSpacing: -0.5 },
  nutritionFactsBar: {
    flexDirection: "row",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#262A24",
    backgroundColor: "#0C0E0C",
    paddingVertical: 16,
    marginTop: 18,
  },
  nutritionFactsRow: { flex: 1, flexDirection: "row", alignItems: "center" },
  nutritionFactsItem: { flex: 1, alignItems: "center", gap: 3 },
  nutritionFactsIcon: { fontSize: 16 },
  nutritionFactsValue: { color: colors.text, fontSize: 15, fontWeight: "800" },
  nutritionFactsLabel: { color: colors.muted, fontSize: 8, fontWeight: "800", letterSpacing: 0.6 },
  nutritionFactsDivider: { width: 1, height: 32, backgroundColor: "rgba(255,255,255,0.12)" },
  recipeSectionTitle: {
    color: colors.lime,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginTop: 22,
    marginBottom: 10,
  },
  recipeStepRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
  recipeStepNumber: {
    color: colors.ink,
    backgroundColor: colors.lime,
    width: 20,
    height: 20,
    borderRadius: 10,
    textAlign: "center",
    fontSize: 11,
    fontWeight: "900",
    lineHeight: 20,
  },
  recipeStepText: { color: "#CFD3CC", fontSize: 12, lineHeight: 18, flex: 1 },
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
    paddingTop: 18,
    paddingBottom: 18,
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
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lime,
    marginBottom: 14,
  },
  completeMarkText: { color: colors.ink, fontSize: 30, lineHeight: 35, fontWeight: "900" },
  completeEyebrow: { color: colors.lime, fontSize: 10, fontWeight: "900", letterSpacing: 1.8 },
  workoutCompleteTitle: {
    color: colors.text,
    fontSize: 32,
    lineHeight: 36,
    fontWeight: "900",
    letterSpacing: -1.2,
    marginTop: 6,
  },
  completeSubtitle: {
    maxWidth: 350,
    color: colors.muted,
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 8,
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
    paddingVertical: 15,
    marginTop: 16,
  },
  completeStat: { flex: 1, alignItems: "center" },
  completeStatValue: { color: colors.text, fontSize: 19, fontWeight: "900" },
  completeStatLabel: { color: colors.muted, fontSize: 7, fontWeight: "900", letterSpacing: 1.1, marginTop: 4 },
  completeStatDivider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.12)" },
  completeAnalysis: {
    width: "100%",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    backgroundColor: "#0D0F0D",
    paddingHorizontal: 16,
    paddingTop: 11,
    marginTop: 10,
  },
  completeAnalysisTitle: {
    color: colors.lime,
    fontSize: 8,
    fontWeight: "900",
    letterSpacing: 1.3,
    marginBottom: 3,
  },
  completeAnalysisRow: {
    minHeight: 28,
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
    padding: 14,
    marginTop: 10,
  },
  completeCoachLabel: { color: colors.lime, fontSize: 8, fontWeight: "900", letterSpacing: 1.2 },
  completeCoachText: { color: colors.text, fontSize: 12, lineHeight: 17, marginTop: 5 },
  completeButton: {
    width: "100%",
    minHeight: 52,
    borderRadius: 26,
    backgroundColor: colors.lime,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    marginTop: 12,
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
  deloadBanner: {
    marginHorizontal: 16,
    marginBottom: 6,
    paddingVertical: 6,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "rgba(200,255,50,0.1)",
  },
  deloadBannerText: { color: colors.lime, fontSize: 8, fontWeight: "900", letterSpacing: 0.8 },
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
    paddingHorizontal: 18,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    backgroundColor: "#090A09",
  },
  exerciseHeadingRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  exerciseActionRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  exerciseActionPill: {
    flex: 1,
    minHeight: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lime,
  },
  exerciseActionPillText: { color: colors.ink, fontSize: 10, fontWeight: "900", letterSpacing: 0.8 },
  exerciseStep: { color: colors.lime, fontSize: 7, fontWeight: "800", letterSpacing: 1.2 },
  exerciseName: { color: colors.text, fontSize: 19, lineHeight: 22, fontWeight: "700", marginTop: 3, letterSpacing: -0.7 },
  exerciseTarget: { color: colors.muted, fontSize: 9, marginTop: 2 },
  exerciseInfoBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  tooSoonCard: {
    width: "100%",
    maxWidth: 520,
    padding: 24,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: "#242824",
    backgroundColor: colors.background,
  },
  tooSoonTitle: { color: colors.text, fontSize: 19, fontWeight: "800", marginBottom: 10 },
  tooSoonBody: { color: colors.muted, fontSize: 13, lineHeight: 19, marginBottom: 20 },
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
  mismatchWarning: {
    marginTop: 8,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(200,255,50,0.3)",
    backgroundColor: "rgba(200,255,50,0.08)",
  },
  mismatchWarningText: { color: colors.text, fontSize: 13, lineHeight: 19, marginBottom: 14 },
  mismatchBackText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "700",
    textAlign: "center",
    marginTop: 12,
  },
  swapLoadingText: { color: colors.muted, fontSize: 13, marginTop: 24, textAlign: "center" },
  swapOptionRow: {
    minHeight: 64,
    marginTop: 12,
    paddingHorizontal: 10,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#242824",
    backgroundColor: "#0E100E",
  },
  swapOptionThumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: "#1A1D19" },
  swapOptionCopy: { flex: 1 },
  swapOptionName: { color: colors.text, fontSize: 14, fontWeight: "700" },
  swapOptionTarget: { color: colors.muted, fontSize: 10, marginTop: 2, textTransform: "capitalize" },
  restBanner: {
    minHeight: 40,
    borderRadius: 13,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(200,255,50,0.24)",
    backgroundColor: "rgba(200,255,50,0.065)",
  },
  restLabel: { color: colors.lime, fontSize: 7, fontWeight: "900", letterSpacing: 1.1 },
  restHint: { color: colors.muted, fontSize: 8, marginTop: 2 },
  restValue: { color: colors.text, fontSize: 18, fontWeight: "800" },
  restAdjustRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  restAdjustButton: {
    minWidth: 34,
    minHeight: 26,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(200,255,50,0.3)",
  },
  restAdjustButtonText: { color: colors.lime, fontSize: 10, fontWeight: "800" },
  restSkipButton: {
    minHeight: 26,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lime,
  },
  restSkipButtonText: { color: colors.ink, fontSize: 8, fontWeight: "900", letterSpacing: 0.5 },
  setTableHeader: { flexDirection: "row", alignItems: "center", paddingHorizontal: 11, marginTop: 8, marginBottom: 4 },
  setHeaderText: { color: "#666C64", fontSize: 7, fontWeight: "800", letterSpacing: 1 },
  setColumn: { width: 42 },
  weightColumn: { flex: 1 },
  repsColumn: { width: 68 },
  doneColumn: { width: 36 },
  adjustPanel: {
    borderRadius: 14,
    padding: 9,
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#242824",
    backgroundColor: "#0E100E",
  },
  adjustPanelLabel: { color: colors.lime, fontSize: 11, fontWeight: "900", letterSpacing: 1, marginBottom: 5, textAlign: "center" },
  adjustPanelPickers: { flexDirection: "row", alignItems: "flex-start", justifyContent: "center", gap: 24 },
  adjustPanelSlot: { flex: 1, alignItems: "center", maxWidth: 160 },
  adjustPanelColumnLabel: {
    color: colors.muted,
    fontSize: 7,
    fontWeight: "800",
    letterSpacing: 1,
    marginBottom: 3,
    textAlign: "center",
  },
  adjustPanelMarkRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#242824",
  },
  adjustPanelMarkText: { color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  adjustPanelMarkButton: {
    height: 30,
    paddingHorizontal: 14,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.lime,
  },
  adjustPanelMarkButtonDone: { backgroundColor: "#171A17", paddingHorizontal: 12 },
  adjustPanelMarkButtonText: { color: colors.ink, fontSize: 11, fontWeight: "900", letterSpacing: 0.5 },
  adjustPanelMarkButtonTextDone: { color: colors.lime },
  setList: { gap: 5 },
  setRow: {
    height: 38,
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
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#3A3F38",
  },
  setCheckDone: { borderColor: colors.lime, backgroundColor: colors.lime },
  setCheckText: { color: colors.ink, fontSize: 13, fontWeight: "900" },
  setCheckTextDone: { color: colors.ink },
  nextExerciseButton: {
    height: 46,
    borderRadius: 23,
    marginTop: 8,
    paddingHorizontal: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.lime,
  },
  nextExerciseText: { color: colors.ink, fontSize: 10, fontWeight: "900", letterSpacing: 1.1 },
  nextExerciseArrow: { color: colors.ink, fontSize: 19, fontWeight: "700" },
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
    borderColor: "#2A2F28",
    backgroundColor: "#171A17",
    alignItems: "center",
    justifyContent: "center",
  },
  coachBackText: { color: colors.lime, fontSize: 20, fontWeight: "700" },
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
  coachQuickActionText: { color: "#C7CCC4", fontSize: 9, fontWeight: "700" },
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
  progressScroll: { flex: 1 },
  progressContent: { paddingHorizontal: 20, paddingBottom: 32, flexGrow: 1 },
  progressHeader: {
    height: 50,
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
    marginTop: 8,
  },
  progressTitle: {
    color: colors.text,
    fontSize: 26,
    lineHeight: 29,
    fontWeight: "800",
    letterSpacing: -1,
    marginTop: 4,
  },
  progressSubtitle: { color: colors.muted, fontSize: 11, lineHeight: 15, marginTop: 4 },
  progressHero: {
    minHeight: 104,
    borderRadius: 20,
    marginTop: 20,
    paddingHorizontal: 20,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: "rgba(200,255,50,0.28)",
    backgroundColor: "rgba(200,255,50,0.07)",
  },
  progressScoreValue: { color: colors.text, fontSize: 30, fontWeight: "900", letterSpacing: -1.2 },
  progressScoreLabel: { color: colors.lime, fontSize: 7, fontWeight: "900", letterSpacing: 1.3, marginTop: 2 },
  progressHeroBadge: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 4,
    borderColor: colors.lime,
    backgroundColor: "#0C0F0B",
  },
  progressHeroBadgeValue: { color: colors.text, fontSize: 18, fontWeight: "900" },
  progressHeroBadgeLabel: { color: colors.muted, fontSize: 5, fontWeight: "900", letterSpacing: 0.7 },
  progressMetrics: {
    minHeight: 80,
    borderRadius: 18,
    marginTop: 18,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#252A24",
    backgroundColor: colors.surface,
  },
  progressMetric: { flex: 1, alignItems: "center" },
  progressMetricDivider: { width: 1, height: 30, backgroundColor: "#2C312B" },
  progressMetricValue: { color: colors.text, fontSize: 18, fontWeight: "900" },
  progressMetricLabel: { color: colors.muted, fontSize: 6, fontWeight: "900", letterSpacing: 1, marginTop: 3 },
  progressSection: {
    borderRadius: 18,
    marginTop: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "#252A24",
    backgroundColor: colors.surface,
  },
  progressSectionTitle: { color: colors.text, fontSize: 9, fontWeight: "900", letterSpacing: 1.4, marginBottom: 8 },
  progressRowTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  progressRowLabel: { color: colors.muted, fontSize: 10 },
  progressRowValue: { color: colors.text, fontSize: 10, fontWeight: "800" },
  progressRowPositive: { color: colors.lime, fontSize: 10, fontWeight: "900" },
  analysisProgressTrack: { height: 5, borderRadius: 3, backgroundColor: "#242924", marginTop: 8, overflow: "hidden" },
  analysisProgressFill: { height: "100%", borderRadius: 3, backgroundColor: colors.lime },
  progressEmptyText: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 7,
    borderTopWidth: 1,
    borderTopColor: "#212620",
  },
  historyDateChip: {
    width: 40,
    height: 28,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#171A17",
  },
  historyDateText: { color: colors.lime, fontSize: 9, fontWeight: "800" },
  historyRowCopy: { flex: 1 },
  historyTitleText: { color: colors.text, fontSize: 11, fontWeight: "800" },
  historyMetaText: { color: colors.muted, fontSize: 9, marginTop: 2 },
  historyCaloriesText: { color: colors.muted, fontSize: 9, fontWeight: "700" },
  progressPriority: {
    marginTop: 10,
    paddingTop: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#292D28",
  },
  progressPriorityLabel: { color: colors.muted, fontSize: 7, fontWeight: "900", letterSpacing: 1 },
  progressPriorityValue: { color: colors.text, fontSize: 10, fontWeight: "800" },
  progressCoachCard: {
    borderRadius: 18,
    marginTop: 18,
    marginBottom: 8,
    padding: 16,
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: "#111510",
  },
  progressCoachMark: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.lime,
  },
  progressCoachMarkText: { color: colors.text, fontSize: 11, fontWeight: "900" },
  progressCoachCopy: { flex: 1, marginLeft: 12 },
  progressCoachLabel: { color: colors.lime, fontSize: 7, fontWeight: "900", letterSpacing: 1 },
  progressCoachText: { color: "#C4CAC1", fontSize: 10, lineHeight: 15, marginTop: 5 },
});
