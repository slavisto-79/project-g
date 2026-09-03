import { createElement, Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
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
import { isSupabaseConfigured, supabase } from "./lib/supabase";
import {
  buildProgram,
  determineSplitDay,
  splitDaySlotCount,
  splitDaySlots,
  splitDaySpineLength,
  suitsBodyweightCapability,
  type ProgramBuilderProfile,
  type SplitDay,
} from "./lib/programBuilder";
import { type ExercisePose, type PoseProp } from "./lib/poses";
import { exercisePoses, type PoseName } from "./lib/poseData";
import { PoseViewer3D, type ViewerImplement } from "./lib/poseViewer3d";
import {
  exercisesForTier,
  suitsGoal,
  type EquipmentTier,
  type LibraryExercise,
  type LibraryImplement,
} from "./lib/exerciseLibrary";
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
  | "dietPlan"
  | "auth"
  | "resetPassword"
  | "profile"
  | "checkIn";

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
  // Several answers can be true at once -- plenty of people have both a bad
  // knee and a bad shoulder, and making them pick one hides the other from
  // every filter downstream. Stored comma-separated, like reminderDays.
  multiSelect?: boolean;
  // Rewrites the question's wording from answers already given. "What pace
  // suits you?" is meaningless on its own -- pace of what? -- and the honest
  // answer depends on whether the person is heading up or down, which they
  // have already told us by this point.
  resolveCopy?: (answers: Record<string, string>) => { kicker?: string; title?: string; subtitle?: string };
  // When set, picking the answer whose value matches `whenValue` reveals a
  // free-text field, stored on the profile under `noteId`. A fixed list can't
  // anticipate every limitation someone might have.
  note?: { whenValue: string; noteId: string; placeholder: string };
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
    subtitle: "This sets your calorie maths and exercise demos. It can’t be changed later.",
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
      { label: "Become more athletic", value: "athletic" },
    ],
  },
  {
    kind: "picker",
    id: "goalWeight",
    kicker: "WHERE YOU’RE HEADED",
    title: "What weight are you aiming for?",
    subtitle: "Set it level with your current weight if you’d rather not chase a number.",
    unit: "kg",
    min: 40,
    max: 200,
    step: 1,
    defaultValue: 75,
  },
  {
    kind: "choice",
    id: "dietPace",
    kicker: "HOW FAST TO CHANGE WEIGHT",
    title: "How fast do you want to lose or gain?",
    subtitle:
      "This sets how big a daily calorie gap we aim for. Faster moves the scale sooner but is harder to stick to.",
    resolveCopy: (answers) => {
      const currentKg = Number(answers.weight);
      const goalKg = Number(answers.goalWeight);
      const differenceKg =
        Number.isFinite(currentKg) && Number.isFinite(goalKg) ? goalKg - currentKg : 0;
      if (differenceKg <= -2) {
        return {
          kicker: "HOW FAST TO LOSE WEIGHT",
          title: `How fast do you want to lose the ${Math.round(Math.abs(differenceKg))} kg?`,
          subtitle:
            "This sets how big a daily calorie deficit we aim for. Faster gets you there sooner but is harder to stick to.",
        };
      }
      if (differenceKg >= 2) {
        return {
          kicker: "HOW FAST TO GAIN WEIGHT",
          title: `How fast do you want to gain the ${Math.round(differenceKg)} kg?`,
          subtitle:
            "This sets how big a daily calorie surplus we aim for. Faster adds weight sooner, but more of it as fat.",
        };
      }
      // Target and current weight match, so nothing here changes the plan --
      // say so rather than asking as if it mattered.
      return {
        kicker: "HOW FAST TO CHANGE WEIGHT",
        title: "Holding your weight steady",
        subtitle:
          "Your target matches your current weight, so we’ll aim for maintenance. Pick anything — it only takes effect if you change your target later.",
      };
    },
    answers: [
      { label: "Slow and comfortable", value: "slow" },
      { label: "Steady", value: "steady" },
      { label: "As fast as sensible", value: "fast" },
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
    id: "recentTraining",
    kicker: "WHERE YOU ARE RIGHT NOW",
    title: "Have you trained recently?",
    subtitle: "Years of experience don’t fade, but conditioning does. This sets your starting load.",
    answers: [
      { label: "Training consistently", value: "consistent" },
      { label: "On and off", value: "patchy" },
      { label: "Coming back after months off", value: "returning" },
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
    id: "activity",
    kicker: "THE OTHER 23 HOURS",
    title: "How active is the rest of your day?",
    subtitle: "Your job and daily movement shift your calorie needs more than training does.",
    answers: [
      { label: "Desk job, little walking", value: "sedentary" },
      { label: "Some walking or standing", value: "light" },
      { label: "On my feet most of the day", value: "active" },
      { label: "Physical or manual work", value: "physical" },
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
    id: "bodyweightStrength",
    kicker: "YOUR STARTING POINT",
    title: "Can you do a full push-up and a pull-up?",
    subtitle: "Be honest — this decides whether we start you on the full move or build you up to it.",
    answers: [
      { label: "Both, comfortably", value: "both" },
      { label: "Push-ups yes, pull-ups no", value: "pushups" },
      { label: "Neither yet", value: "neither" },
    ],
  },
  {
    kind: "choice",
    id: "limitations",
    kicker: "TRAIN SMARTER, NOT THROUGH PAIN",
    title: "Do you have any limitations?",
    subtitle: "Pick every one that applies. Your coach adapts movements around them. This is not medical advice.",
    multiSelect: true,
    answers: [
      { label: "No current limitations", value: "none" },
      { label: "Shoulder sensitivity", value: "shoulder" },
      { label: "Back sensitivity", value: "back" },
      { label: "Knee sensitivity", value: "knee" },
      { label: "Something else", value: "other" },
    ],
    note: {
      whenValue: "other",
      noteId: "limitationsNote",
      placeholder: "Wrist pain on push-ups, recovering ankle sprain, hernia…",
    },
  },
];

// Question wording after any answer-dependent rewrite. Falls straight
// through for the questions that do not define one.
function resolvedQuestionCopy(
  question: InterviewQuestion,
  answers: Record<string, string>,
): { kicker: string; title: string; subtitle: string } {
  const override = question.kind === "choice" ? question.resolveCopy?.(answers) : undefined;
  return {
    kicker: override?.kicker ?? question.kicker,
    title: override?.title ?? question.title,
    subtitle: override?.subtitle ?? question.subtitle,
  };
}

// A multi-select answer is stored as one comma-separated string, so the whole
// profile stays a flat Record<string, string> and persists unchanged.
function splitAnswerValues(value: string | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

// "None" is the odd one out: it means the absence of the others, so it can't
// sit alongside them. Picking it clears the rest, and picking anything else
// clears it.
const EXCLUSIVE_ANSWER_VALUES = new Set(["none"]);

function toggleAnswerValue(current: string | undefined, value: string): string {
  const selected = splitAnswerValues(current);
  if (selected.includes(value)) return selected.filter((entry) => entry !== value).join(",");
  if (EXCLUSIVE_ANSWER_VALUES.has(value)) return value;
  return [...selected.filter((entry) => !EXCLUSIVE_ANSWER_VALUES.has(entry)), value].join(",");
}

// Answers that are fixed once onboarding is done, each for its own reason.
//
// "sex" feeds the BMR constant and picks which demo videos load -- it isn't a
// preference to retune, and flipping it would silently rewrite every calorie
// target.
//
// "experience" exists to place someone correctly on day one. After that the
// app earns their progression for them, session by session: rep floors, load
// factors, set counts and how many sessions an advance takes all key off this
// answer. Letting someone jump to "advanced" would reprice progress they
// haven't made yet, on top of exercise history recorded under the old rules.
//
// Both stay editable during onboarding itself, and RESET PROFILE clears
// everything and re-runs the interview -- that's the deliberate way back.
const LOCKED_AFTER_ONBOARDING: Record<string, string> = {
  sex: "Set during onboarding",
  experience: "Your plan progresses this for you",
};

const WHEEL_ITEM_HEIGHT = 52;
const WHEEL_VISIBLE_ITEMS = 5;

function NumberWheelPicker({
  min,
  max,
  step,
  values,
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
  // Explicit list of selectable numbers, for scales that aren't evenly
  // spaced -- gym weights being the case that matters: dumbbells jump 1kg
  // then 2kg then 2.5kg, so an even min/max/step ladder would offer weights
  // that don't exist. Falls back to min/max/step when omitted.
  values?: number[];
  unit: string;
  value: number;
  onChange: (value: number) => void;
  itemHeight?: number;
  visibleItems?: number;
  fontSize?: number;
}) {
  const numbers = useMemo(() => {
    if (values) return values;
    const list: number[] = [];
    for (let n = min; n <= max; n += step) list.push(n);
    return list;
  }, [min, max, step, values]);
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
  // A free-text answer that's left blank is the same dead end as the old
  // "I'll discuss it with my coach" option: the user believes they've flagged
  // something and nothing acts on it. So the note is required once its answer
  // is picked.
  const selectedValues = splitAnswerValues(selected);
  const questionCopy = question
    ? resolvedQuestionCopy(question, answers)
    : { kicker: "", title: "", subtitle: "" };
  const activeNote =
    question?.kind === "choice" && question.note && selectedValues.includes(question.note.whenValue)
      ? question.note
      : null;
  const noteValue = activeNote ? (answers[activeNote.noteId] ?? "") : "";
  const canContinue =
    selectedValues.length > 0 && (!activeNote || noteValue.trim().length > 0);
  const progress = complete ? 1 : (step + 1) / interviewQuestions.length;
  const goalLabels: Record<string, string> = {
    muscle: "Build muscle",
    "fat-loss": "Lose body fat",
    strength: "Get stronger",
    fitness: "Improve fitness",
    athletic: "Become more athletic",
    // Legacy: the goal this replaced. Kept so a profile saved before the
    // change still shows a name rather than "Not set".
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
          <ScrollView
            style={styles.questionContent}
            contentContainerStyle={styles.questionContentInner}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.previewStep}>{questionCopy.kicker}</Text>
            <Text style={styles.previewTitle}>{questionCopy.title}</Text>
            <Text style={styles.previewBody}>{questionCopy.subtitle}</Text>
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
                const isSelected = selectedValues.includes(answer.value);
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    key={answer.value}
                    onPress={() =>
                      selectAnswer(
                        question.multiSelect ? toggleAnswerValue(selected, answer.value) : answer.value,
                      )
                    }
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
            {activeNote ? (
              <TextInput
                accessibilityLabel="Describe your limitation"
                value={noteValue}
                onChangeText={(text) =>
                  setAnswers((current) => ({ ...current, [activeNote.noteId]: text.slice(0, 300) }))
                }
                placeholder={activeNote.placeholder}
                placeholderTextColor={colors.muted}
                multiline
                style={styles.limitationNoteInput}
              />
            ) : null}
          </ScrollView>
          <View style={styles.interviewFooter}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Continue"
              disabled={!canContinue}
              onPress={goNext}
              style={({ pressed }) => [
                styles.continueButton,
                !canContinue && styles.continueButtonDisabled,
                pressed && canContinue ? styles.startButtonPressed : null,
              ]}
            >
              <Text style={[styles.continueButtonText, !canContinue && styles.continueButtonTextDisabled]}>
                CONTINUE
              </Text>
              <Text style={[styles.continueArrow, !canContinue && styles.continueButtonTextDisabled]}>→</Text>
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
  onResetProfile,
  trialDaysLeft,
  trialEndsAtLabel,
}: {
  profile: Record<string, string>;
  onUpdateProfile: (id: string, value: string) => void;
  onBack: () => void;
  session: { email: string } | null;
  onOpenAccount: (mode: "signup" | "login") => void;
  onLogout: () => void;
  onResetProfile: () => void;
  trialDaysLeft: number | null;
  trialEndsAtLabel: string | null;
}) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState<string>("");
  const [draftNote, setDraftNote] = useState<string>("");
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  // Two-tap confirm for a destructive action -- first tap arms it, second
  // (within a few seconds) actually resets. Auto-disarms so a stray second
  // tap much later, after forgetting it was armed, can't trigger it.
  const [resetArmed, setResetArmed] = useState(false);
  const editingQuestion = interviewQuestions.find((question) => question.id === editingId) ?? null;

  useEffect(() => {
    if (!resetArmed) return;
    const timer = setTimeout(() => setResetArmed(false), 4000);
    return () => clearTimeout(timer);
  }, [resetArmed]);

  // Shrink each profile row just enough that all of them plus the header/account
  // bar fit on one screen without scrolling, instead of a fixed height that
  // overflows on smaller phones.
  const { height: windowHeight } = useWindowDimensions();
  const chromeHeight = 70 + 50 + (trialDaysLeft !== null ? 46 : 0) + 30 + 40;
  const availableForRows = Math.max(280, windowHeight - chromeHeight);
  const profileRowHeight = Math.max(40, Math.min(52, availableForRows / interviewQuestions.length));

  const startEditing = (question: InterviewQuestion) => {
    // Locked rows aren't pressable, but guard here too so the only mutation
    // path out of this screen can't be reached by any other route.
    if (LOCKED_AFTER_ONBOARDING[question.id]) return;
    // "How often can you train?" also drives the reminders day/time picker --
    // edit both together instead of just the plain number.
    if (question.id === "frequency") {
      setScheduleModalOpen(true);
      return;
    }
    setDraftValue(profile[question.id] ?? (question.kind === "picker" ? String(question.defaultValue) : ""));
    setDraftNote(question.kind === "choice" && question.note ? (profile[question.note.noteId] ?? "") : "");
    setEditingId(question.id);
  };

  const draftValues = splitAnswerValues(draftValue);
  const editingCopy = editingQuestion
    ? resolvedQuestionCopy(editingQuestion, profile)
    : { kicker: "", title: "", subtitle: "" };
  const editingNote =
    editingQuestion?.kind === "choice" &&
    editingQuestion.note &&
    draftValues.includes(editingQuestion.note.whenValue)
      ? editingQuestion.note
      : null;

  const saveEdit = () => {
    if (!editingQuestion || !draftValue) return;
    if (editingNote && draftNote.trim().length === 0) return;
    onUpdateProfile(editingQuestion.id, draftValue);
    if (editingQuestion.kind === "choice" && editingQuestion.note) {
      // Clearing the note when the answer moves away from "other" keeps a
      // stale description from being fed to the veto for a limitation the
      // user no longer reports.
      onUpdateProfile(editingQuestion.note.noteId, editingNote ? draftNote.trim() : "");
    }
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
    // Show the free text itself rather than "Something else" -- what the user
    // wrote is the actual answer, and it's what the session is adapted around.
    if (question.note && value === question.note.whenValue) {
      const note = (profile[question.note.noteId] ?? "").trim();
      if (note) return note;
    }
    const selectedLabels = splitAnswerValues(value)
      .map((entry) => question.answers.find((answer) => answer.value === entry)?.label)
      .filter((label): label is string => Boolean(label));
    return selectedLabels.length > 0 ? selectedLabels.join(", ") : "Not set";
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
        <ScrollView
          style={styles.questionContent}
          contentContainerStyle={styles.questionContentInner}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Text style={styles.previewStep}>{editingCopy.kicker}</Text>
          <Text style={styles.previewTitle}>{editingCopy.title}</Text>
          <Text style={styles.previewBody}>{editingCopy.subtitle}</Text>
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
                const isSelected = draftValues.includes(answer.value);
                return (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ selected: isSelected }}
                    key={answer.value}
                    onPress={() =>
                      setDraftValue(
                        editingQuestion.multiSelect
                          ? toggleAnswerValue(draftValue, answer.value)
                          : answer.value,
                      )
                    }
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
          {editingNote ? (
            <TextInput
              accessibilityLabel="Describe your limitation"
              value={draftNote}
              onChangeText={(text) => setDraftNote(text.slice(0, 300))}
              placeholder={editingNote.placeholder}
              placeholderTextColor={colors.muted}
              multiline
              style={styles.limitationNoteInput}
            />
          ) : null}
        </ScrollView>
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
                accessibilityLabel={resetArmed ? "Confirm reset profile and progress" : "Reset profile and progress"}
                onPress={() => {
                  if (resetArmed) {
                    onResetProfile();
                    setResetArmed(false);
                  } else {
                    setResetArmed(true);
                  }
                }}
                style={styles.testModeReset}
              >
                <Text style={styles.testModeResetText}>{resetArmed ? "TAP AGAIN TO RESET" : "RESET PROFILE"}</Text>
              </Pressable>
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
          {interviewQuestions.map((question, index) => {
            const lockedReason = LOCKED_AFTER_ONBOARDING[question.id];
            const rowStyle = [
              styles.profileRow,
              { minHeight: profileRowHeight },
              index === interviewQuestions.length - 1 && { borderBottomWidth: 0 },
            ];
            const rowBody = (
              <>
                <Text style={[styles.profileRowLabel, lockedReason && styles.profileRowLabelLocked]}>
                  {question.title}
                </Text>
                <View style={styles.profileRowRight}>
                  <Text
                    style={[styles.profileRowValue, lockedReason && styles.profileRowValueLocked]}
                    numberOfLines={1}
                  >
                    {formatValue(question)}
                  </Text>
                  <Text style={lockedReason ? styles.profileRowLock : styles.cardChevron}>
                    {lockedReason ? "🔒" : "›"}
                  </Text>
                </View>
              </>
            );

            // Rendered as a plain View, not a disabled Pressable: nothing to
            // press means no tap feedback promising an edit that won't happen.
            return lockedReason ? (
              <View
                key={question.id}
                accessibilityRole="text"
                accessibilityLabel={`${question.title}: ${formatValue(question)}. ${lockedReason}, cannot be changed.`}
                style={rowStyle}
              >
                {rowBody}
              </View>
            ) : (
              <Pressable
                key={question.id}
                accessibilityRole="button"
                accessibilityLabel={`Edit ${question.title}`}
                onPress={() => startEditing(question)}
                style={({ pressed }) => [...rowStyle, pressed && { opacity: 0.8 }]}
              >
                {rowBody}
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.profileLockedNote}>
          🔒 Locked after setup. Your training background moves as you earn it — reset your profile
          to start over.
        </Text>
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

// Tabs used to swap instantly, which read as a jump cut rather than a change
// of place. A short fade with a little upward drift is enough to make the new
// screen feel like it arrived.
//
// Enter-only on purpose: animating the outgoing screen out as well would mean
// holding two screens mounted at once, and a tab change would feel slower than
// it is. Nobody is waiting to watch the old screen leave.
// Slower than the first pass, which landed before the eye had followed it.
// The drift grew with the duration: holding a small offset over a longer
// window reads as sluggish rather than smooth, because there is time to
// notice the movement but not much movement to notice.
const SCREEN_TRANSITION_MS = 280;
const SCREEN_TRANSITION_DRIFT = 14;

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (!cancelled) setReduced(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener("reduceMotionChanged", setReduced);
    return () => {
      cancelled = true;
      subscription.remove();
    };
  }, []);
  return reduced;
}

function ScreenTransition({ screenKey, children }: { screenKey: string; children: ReactNode }) {
  const reducedMotion = useReducedMotion();
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      // Land on the finished state rather than skipping the effect, so a
      // mid-animation preference change can't strand a screen half-faded.
      opacity.setValue(1);
      translateY.setValue(0);
      return;
    }
    opacity.setValue(0);
    translateY.setValue(SCREEN_TRANSITION_DRIFT);
    const animation = Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: SCREEN_TRANSITION_MS,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: SCREEN_TRANSITION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [screenKey, reducedMotion, opacity, translateY]);

  return (
    <Animated.View style={[styles.screenTransition, { opacity, transform: [{ translateY }] }]}>
      {children}
    </Animated.View>
  );
}

// A small lift as a tab becomes active, so the tap has a visible consequence
// in the bar itself and not only in the screen above it. Spring rather than
// timing: this is a response to a press, and a press should feel physical.
function NavIcon({ icon, isActive }: { icon: string; isActive: boolean }) {
  const reducedMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(isActive ? 1 : 0.92)).current;

  useEffect(() => {
    const target = isActive ? 1 : 0.92;
    if (reducedMotion) {
      scale.setValue(target);
      return;
    }
    const animation = Animated.spring(scale, {
      toValue: target,
      // Softer and slower than the default pop, to sit with the screen
      // transition rather than finishing well ahead of it.
      friction: 7,
      tension: 110,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [isActive, reducedMotion, scale]);

  return (
    <Animated.View
      style={[styles.navIconWrap, isActive && styles.navIconWrapActive, { transform: [{ scale }] }]}
    >
      <Text style={[styles.navIcon, !isActive && styles.navIconInactive]}>{icon}</Text>
    </Animated.View>
  );
}

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
            <NavIcon icon={item.icon} isActive={isActive} />
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
  dailyCheckIn,
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
  dailyCheckIn: DailyCheckIn | null;
  trialDaysLeft: number | null;
}) {
  const reminderDays = profile.reminderDays ? profile.reminderDays.split(",") : [];
  const todaySplit = determineSplitDay(reminderDays, recentSplitDaysFromHistory(workoutHistory));
  const workoutName = todaySplit.label;
  const { isDeload } = getMesocycleWeek(workoutHistory);
  const exerciseCount = plannedExerciseCount(
    profile,
    splitDaySlotCount(todaySplit.day),
    null,
    isDeload,
    todaysCheckIn(dailyCheckIn),
  );
  const weeklyGoal = profile.frequency ?? "3";
  const thisWeekCount = workoutHistory.filter((entry) => isWithinLastDays(entry.date, 7)).length;
  const lastWorkout = workoutHistory[0];
  const readiness = computeReadiness(workoutHistory, dailyCheckIn);

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

const checkInQuestions = [
  {
    id: "sleep" as const,
    label: "SLEEP",
    title: "How did you sleep?",
    lowLabel: "Terrible",
    highLabel: "Great",
  },
  {
    id: "nutrition" as const,
    label: "NUTRITION",
    title: "How is your eating today?",
    lowLabel: "Poor",
    highLabel: "On point",
  },
  {
    id: "fatigue" as const,
    label: "FATIGUE",
    title: "How tired do you feel?",
    lowLabel: "Fresh",
    highLabel: "Exhausted",
  },
  {
    id: "stress" as const,
    label: "STRESS",
    title: "How stressed are you?",
    lowLabel: "Calm",
    highLabel: "Very high",
  },
];

// Tap-only pre-workout check-in: four 1-10 scales, no text entry anywhere.
// Defaults to the neutral midpoint so someone who just wants to train can
// tap straight through, and can be skipped outright.
function CheckInScreen({
  previousCheckIn,
  onSkip,
  onSubmit,
}: {
  previousCheckIn: DailyCheckIn | null;
  onSkip: () => void;
  onSubmit: (checkIn: DailyCheckIn) => void;
}) {
  const [answers, setAnswers] = useState<Record<string, number>>({
    sleep: previousCheckIn?.sleep ?? 6,
    nutrition: previousCheckIn?.nutrition ?? 6,
    fatigue: previousCheckIn?.fatigue ?? 5,
    stress: previousCheckIn?.stress ?? 5,
  });

  return (
    <SafeAreaView style={styles.recipesScreen}>
      <View style={styles.nutritionHeader}>
        <Pressable accessibilityRole="button" accessibilityLabel="Skip check-in" onPress={onSkip} style={styles.coachBack}>
          <Text style={styles.coachBackText}>‹</Text>
        </Pressable>
        <View>
          <Text style={styles.nutritionHeaderTitle}>TODAY’S CHECK-IN</Text>
          <Text style={styles.nutritionHeaderSubtitle}>We’ll tune today’s session to match</Text>
        </View>
        <View style={styles.coachHeaderSpacer} />
      </View>

      <ScrollView
        style={styles.nutritionScroll}
        contentContainerStyle={styles.nutritionContent}
        showsVerticalScrollIndicator={false}
      >
        {checkInQuestions.map((question) => (
          <View key={question.id} style={styles.checkInGroup}>
            <Text style={styles.dietGroupLabel}>{question.label}</Text>
            <Text style={styles.checkInQuestionTitle}>{question.title}</Text>
            <View style={styles.checkInScaleRow}>
              {Array.from({ length: 10 }, (_, index) => index + 1).map((value) => {
                const isSelected = answers[question.id] === value;
                return (
                  <Pressable
                    key={value}
                    accessibilityRole="button"
                    accessibilityLabel={`${question.label} ${value} of 10`}
                    accessibilityState={{ selected: isSelected }}
                    onPress={() => setAnswers((current) => ({ ...current, [question.id]: value }))}
                    style={[styles.checkInDot, isSelected && styles.checkInDotSelected]}
                  >
                    <Text style={[styles.checkInDotText, isSelected && styles.checkInDotTextSelected]}>{value}</Text>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.checkInScaleLegend}>
              <Text style={styles.checkInScaleLegendText}>{question.lowLabel}</Text>
              <Text style={styles.checkInScaleLegendText}>{question.highLabel}</Text>
            </View>
          </View>
        ))}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Start workout"
          onPress={() =>
            onSubmit({
              date: todayDateKey(),
              sleep: answers.sleep ?? 6,
              nutrition: answers.nutrition ?? 6,
              fatigue: answers.fatigue ?? 5,
              stress: answers.stress ?? 5,
            })
          }
          style={styles.dietBuildButton}
        >
          <Text style={styles.dietBuildButtonText}>START WORKOUT</Text>
          <Text style={styles.dietBuildButtonArrow}>→</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip and use the standard plan"
          onPress={onSkip}
          style={styles.checkInSkipButton}
        >
          <Text style={styles.checkInSkipText}>SKIP — USE STANDARD PLAN</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

type NutritionTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

// A target rep RANGE, not a single number, is what makes progression
// individual instead of formulaic: the suggested number is always the
// conservative bottom of the range (repsLow), and only a genuinely strong
// session -- logging repsHigh or more, on every prescribed set, two times in
// a row -- earns an advance. One good day never counts; a fluke never
// derails it either (streak just resets, nothing is lost).
type ExerciseProgress = {
  weightKg: number;
  repsLow: number;
  repsHigh: number;
  streak: number;
  // Cumulative successful weight advances on this exercise, ever. Only used
  // to graduate a weighted exercise out of the beginner/novice rep floor
  // (see commitExerciseProgress) -- bodyweight exercises don't read it.
  totalAdvances: number;
};

// Real accounts already have progress saved in the old shape (a flat
// { weightKg, reps }, from before ranges existed). Rather than a one-time
// data migration, every read of a saved entry goes through this so an old
// record just quietly starts fresh at the profile's current range on next
// view -- the weight, if it's a real number, is the only part worth keeping
// from a shape that no longer matches.
function normalizeExerciseProgress(
  saved: ExerciseProgress,
  fallbackRange: { low: number; high: number },
): ExerciseProgress {
  if (typeof saved.repsLow === "number" && typeof saved.repsHigh === "number") {
    return {
      ...saved,
      streak: typeof saved.streak === "number" ? saved.streak : 0,
      totalAdvances: typeof saved.totalAdvances === "number" ? saved.totalAdvances : 0,
    };
  }
  return {
    weightKg: typeof saved.weightKg === "number" ? saved.weightKg : 0,
    repsLow: fallbackRange.low,
    repsHigh: fallbackRange.high,
    streak: 0,
    totalAdvances: 0,
  };
}

// Whether a saved record's weight represents anything the person actually
// earned.
//
// A record is written after every finished exercise, including when nothing
// advanced -- and in that case its weightKg is only a copy of whatever the
// plan suggested that day. (An in-session picker adjustment isn't persisted
// either: commitExerciseProgress only reads the logged weight on the advance
// branch.) So with no advances behind it, the stored number carries no
// information worth preserving, and deferring to freshly computed logic is
// strictly better.
//
// This is what heals records written before starting weights were fixed per
// exercise and snapped to real gym increments -- a beginner carrying a stale
// 27kg biceps curl gets repriced instead of being stuck with it forever.
function hasEarnedWeight(saved: ExerciseProgress): boolean {
  return (saved.totalAdvances ?? 0) > 0;
}

type WorkoutHistoryExercise = {
  name: string;
  weightKg: number | null;
  reps: number;
  sets: number;
  // These mirror fields on WorkoutExercise, recorded here so volume can be
  // totalled honestly later. Optional because entries logged before this
  // existed don't carry them -- see exerciseVolumeKg, which falls back to
  // deriving each one from the exercise name.
  weightPerHand?: boolean;
  repsPerSide?: "leg" | "side";
  // Whether `reps` holds seconds rather than repetitions. Worth storing
  // rather than re-deriving: a catalog isometric isn't always named "Plank",
  // and the movement pattern that identifies it isn't kept on this record.
  isHold?: boolean;
};

// A bodyweight rep moves real mass, so counting it as zero was wrong -- but
// counting it as a full bodyweight is wrong too. What you actually lift is
// the share of your body above the pivot: a pull-up suspends all of you, a
// push-up leaves a good part of your weight on your toes, and a glute bridge
// only lifts the hips and torso. These fractions are the commonly cited
// biomechanical estimates, rounded; they are approximations by nature, which
// is exactly why the number is reported as "~".
const BODYWEIGHT_LOAD_FRACTION: { match: RegExp; fraction: number }[] = [
  // Fully suspended -- all of your mass, nothing supported.
  // Regressions first: a band or a bench carries part of the load, so these
  // must not inherit the full-bodyweight figure of the movement they stand in
  // for. Order matters -- the broader rules below would otherwise match first.
  { match: /assisted/i, fraction: 0.6 },
  { match: /bench dip/i, fraction: 0.5 },
  { match: /knee push-?up/i, fraction: 0.49 },
  { match: /pull-?up|chin-?up|dip|muscle-?up/i, fraction: 1 },
  // Hanging, but only the legs travel.
  { match: /hanging leg raise|knee raise|leg raise/i, fraction: 0.2 },
  // Standing on one leg: nearly everything, minus the shank of the working leg.
  { match: /lunge|split squat|pistol|step-?up/i, fraction: 0.85 },
  // Both feet down: everything above the knees.
  { match: /squat/i, fraction: 0.8 },
  { match: /burpee/i, fraction: 0.7 },
  // Hands and toes down -- a measured ~64% of bodyweight at the top.
  { match: /push-?up|mountain climbers/i, fraction: 0.64 },
  // Hips and torso only; shoulders and feet stay planted.
  // Standing: everything above the ankles travels.
  { match: /calf raise/i, fraction: 0.9 },
  { match: /glute bridge|hip thrust/i, fraction: 0.4 },
  { match: /high knees/i, fraction: 0.3 },
];

function bodyweightLoadFraction(name: string): number | null {
  return BODYWEIGHT_LOAD_FRACTION.find((entry) => entry.match.test(name))?.fraction ?? null;
}

// True kilograms moved for one logged exercise.
//
// Per-hand and per-side both double the work and they stack: a lunge holding
// a dumbbell in each hand, prescribed per leg, moves four times what the raw
// numbers suggest.
//
// Timed holds are deliberately excluded. Their `reps` field stores SECONDS,
// not repetitions, so folding them in would multiply a duration by a mass and
// call the result kilograms. A 40-second plank is real work, but it isn't
// "weight lifted" and doesn't belong in this total.
//
// This figure is fed to the AI coach as fact, so it needs to be defensible.
function exerciseVolumeKg(item: WorkoutHistoryExercise, bodyWeightKg?: number): number {
  if (!Number.isFinite(item.reps) || !Number.isFinite(item.sets)) return 0;
  if (item.isHold ?? isHoldExercise({ name: item.name })) return 0;

  const perSide = item.repsPerSide ?? perSideUnitLabel(item.name);
  const totalReps = item.reps * (perSide ? 2 : 1) * item.sets;

  // A non-finite weight means the record couldn't express a load at all --
  // treat it as bodyweight rather than letting NaN poison the running total.
  if (item.weightKg === null || !Number.isFinite(item.weightKg) || item.weightKg === 0) {
    const fraction = bodyweightLoadFraction(item.name);
    // No usable bodyweight for this session, or a movement with no sensible
    // load estimate -- count nothing rather than invent a number.
    if (fraction === null || !Number.isFinite(bodyWeightKg ?? NaN) || (bodyWeightKg ?? 0) <= 0) {
      return 0;
    }
    return bodyWeightKg! * fraction * totalReps;
  }

  const perHand = item.weightPerHand ?? isPerHandLoad(item.name, implementForExerciseName(item.name));
  return item.weightKg * (perHand ? 2 : 1) * totalReps;
}

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
  // Bodyweight AT THE TIME of this session, so bodyweight-exercise volume
  // stays historically honest -- a push-up done at 90kg shouldn't be
  // retroactively recounted at today's 80kg once the user loses weight.
  bodyWeightKg?: number;
  // Sessions-per-week the user was aiming for when this was logged. Without
  // it, dropping your frequency from 5 to 2 would retroactively turn every
  // past week into a "perfect" one, and raising it would strip achievements
  // already earned.
  weeklyTarget?: number;
};

// A once-per-day subjective check-in (sleep, nutrition, fatigue, stress),
// each 1-10, collected via tap-only wheel pickers -- no free text. Feeds
// readinessWeightModifier()/setCountForProfile() below so today's plan
// reacts to how the user actually feels, not just time-since-last-session.
type DailyCheckIn = {
  date: string;
  sleep: number;
  nutrition: number;
  fatigue: number;
  stress: number;
};

function todayDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

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

// Reps actually performed, mirroring exerciseVolumeKg's rules: holds count
// seconds rather than reps, and a per-side target is done on both sides.
function exerciseRepCount(item: WorkoutHistoryExercise): number {
  if (!Number.isFinite(item.reps) || !Number.isFinite(item.sets)) return 0;
  if (item.isHold ?? isHoldExercise({ name: item.name })) return 0;
  const perSide = item.repsPerSide ?? perSideUnitLabel(item.name);
  return item.reps * (perSide ? 2 : 1) * item.sets;
}

function entryVolumeKg(entry: WorkoutHistoryEntry, fallbackBodyWeightKg?: number): number {
  return (entry.exerciseBreakdown ?? []).reduce(
    (sum, item) => sum + exerciseVolumeKg(item, entry.bodyWeightKg ?? fallbackBodyWeightKg),
    0,
  );
}

// Midnight on the Monday of that date's week, as a timestamp -- the bucket key
// for streaks and the weekly volume chart. Local time on purpose: a week
// should end when the user's week ends, not UTC's.
function startOfWeekMs(date: Date): number {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  // getDay() is 0 for Sunday, which belongs to the week that began 6 days ago.
  const daysSinceMonday = (start.getDay() + 6) % 7;
  start.setDate(start.getDate() - daysSinceMonday);
  return start.getTime();
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

// Consecutive weeks containing at least one session.
//
// An empty current week does not break the streak -- it hasn't finished yet,
// and punishing someone on Monday morning for not having trained yet would be
// both wrong and demoralising. It just doesn't count toward the total either.
function weeklyStreak(workoutHistory: WorkoutHistoryEntry[]): number {
  const trainedWeeks = trainedWeekKeys(workoutHistory);
  if (trainedWeeks.size === 0) return 0;

  const thisWeek = startOfWeekMs(new Date());
  let cursor = trainedWeeks.has(thisWeek) ? thisWeek : thisWeek - WEEK_MS;
  let streak = 0;
  while (trainedWeeks.has(cursor)) {
    streak += 1;
    cursor -= WEEK_MS;
  }
  return streak;
}

function trainedWeekKeys(workoutHistory: WorkoutHistoryEntry[]): Set<number> {
  const weeks = new Set<number>();
  for (const entry of workoutHistory) {
    const parsed = new Date(entry.date);
    if (!Number.isNaN(parsed.getTime())) weeks.add(startOfWeekMs(parsed));
  }
  return weeks;
}

// The longest run of consecutive weeks in a set of week keys.
function longestConsecutiveWeeks(weekKeys: Set<number>): number {
  let best = 0;
  for (const week of weekKeys) {
    // Only start counting from the beginning of a run, so each run is walked
    // once rather than once per week it contains.
    if (weekKeys.has(week - WEEK_MS)) continue;
    let run = 0;
    let cursor = week;
    while (weekKeys.has(cursor)) {
      run += 1;
      cursor += WEEK_MS;
    }
    if (run > best) best = run;
  }
  return best;
}

// Weeks where the user hit the frequency they were aiming for AT THE TIME.
// Entries logged before weeklyTarget was recorded fall back to their current
// target -- the best available answer for old data.
function perfectWeekKeys(workoutHistory: WorkoutHistoryEntry[], currentTarget: number): Set<number> {
  const sessions = new Map<number, number>();
  const targets = new Map<number, number>();
  for (const entry of workoutHistory) {
    const parsed = new Date(entry.date);
    if (Number.isNaN(parsed.getTime())) continue;
    const week = startOfWeekMs(parsed);
    sessions.set(week, (sessions.get(week) ?? 0) + 1);
    // A week is judged against the highest target in force during it, so
    // raising your goal mid-week can't hand you the badge on the old one.
    const entryTarget = entry.weeklyTarget ?? currentTarget;
    targets.set(week, Math.max(targets.get(week) ?? 0, entryTarget));
  }
  const perfect = new Set<number>();
  for (const [week, count] of sessions) {
    if (count >= Math.max(1, targets.get(week) ?? currentTarget)) perfect.add(week);
  }
  return perfect;
}

// Volume per week for the last `weeks` weeks, oldest first, so the chart reads
// left to right. Weeks with no training are included as zero -- a gap is part
// of the story, and dropping it would silently flatter the trend.
function weeklyVolumeSeries(
  workoutHistory: WorkoutHistoryEntry[],
  weeks: number,
  fallbackBodyWeightKg?: number,
): { weekStartMs: number; volumeKg: number }[] {
  const thisWeek = startOfWeekMs(new Date());
  const buckets = new Map<number, number>();
  for (let i = weeks - 1; i >= 0; i -= 1) buckets.set(thisWeek - i * WEEK_MS, 0);

  for (const entry of workoutHistory) {
    const parsed = new Date(entry.date);
    if (Number.isNaN(parsed.getTime())) continue;
    const week = startOfWeekMs(parsed);
    if (!buckets.has(week)) continue;
    buckets.set(week, (buckets.get(week) ?? 0) + entryVolumeKg(entry, fallbackBodyWeightKg));
  }

  return [...buckets.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([weekStartMs, volumeKg]) => ({ weekStartMs, volumeKg }));
}

// --- Strength standards ----------------------------------------------------
// Where a lift sits against published strength standards, as an estimated
// one-rep max divided by bodyweight.
//
// This is the honest version of "you lift more than X% of people": we hold no
// other users' data, so a percentile would be invented. A named band against
// commonly published standards is a real comparison and can be checked.
//
// THE RATIOS BELOW ARE APPROXIMATE and worth reviewing against a source you
// trust before leaning on them. Bands are deliberately coarse so being a
// little off shifts nobody by more than one level, and the UI labels the
// result an estimate rather than a measurement. Two further caveats baked in:
// our stored weights are working weights, not tested maxima, and for dumbbell
// lifts they are the load in ONE hand, which is the convention these
// standards are usually quoted in.
type StrengthLevel = "Beginner" | "Novice" | "Intermediate" | "Advanced";

type StrengthStandard = {
  match: RegExp;
  // Names that match `match` but must not be rated by it.
  exclude?: RegExp;
  // Thresholds are estimated-1RM ÷ bodyweight, at which Novice, Intermediate
  // and Advanced begin. Below the first is Beginner.
  male: [number, number, number];
  female: [number, number, number];
};

// First match wins, so the overhead family is listed before the bench family --
// otherwise a "shoulder press" would be graded against bench thresholds.
//
// Only movements a published standard actually covers appear here. Flys,
// pulldowns, raises and core work are deliberately absent: inventing a
// threshold for them would put a number on the screen that means nothing.
const STRENGTH_STANDARDS: StrengthStandard[] = [
  {
    match: /shoulder press|overhead press|military press|arnold press|push press|push jerk|landmine press|seated dumbbell press/i,
    male: [0.18, 0.3, 0.42],
    female: [0.11, 0.19, 0.27],
  },
  {
    match: /bench press|chest press|floor press|incline .*press|decline .*press/i,
    male: [0.25, 0.4, 0.55],
    female: [0.15, 0.25, 0.35],
  },
  { match: /row/i, male: [0.25, 0.4, 0.55], female: [0.16, 0.27, 0.38] },
  { match: /deadlift/i, male: [0.3, 0.5, 0.7], female: [0.22, 0.37, 0.52] },
  { match: /squat/i, male: [0.35, 0.55, 0.75], female: [0.26, 0.42, 0.58] },
  {
    // A leg curl is a hamstring machine, not a biceps curl. Graded against
    // biceps thresholds it read as advanced on almost any load -- a 40kg leg
    // curl at 70kg bodyweight cleared the 0.3 advanced ratio nearly twice
    // over and pinned the percentile at its 95 ceiling.
    match: /curl/i,
    exclude: /leg curl|hamstring|nordic/i,
    male: [0.12, 0.2, 0.3],
    female: [0.07, 0.12, 0.18],
  },
];

// Epley. Any 1RM formula drifts at high rep counts, which is another reason
// the bands are coarse rather than a precise number.
function estimatedOneRepMaxKg(weightKg: number, reps: number): number {
  if (!Number.isFinite(weightKg) || !Number.isFinite(reps) || reps <= 0) return weightKg;
  return weightKg * (1 + reps / 30);
}

// Roughly what share of people each band sits above. Published standards are
// themselves built from large samples of real lifts, so their bands carry a
// population meaning -- this restates that, it does not measure our own users
// (we hold no such data, and a percentile invented from nothing would be a
// lie dressed as a statistic).
//
// Capped at 95: the tail beyond "advanced" is thin and a formula extrapolating
// into it would start printing numbers it cannot support.
const BAND_PERCENTILES = { beginner: 0, novice: 20, intermediate: 50, advanced: 80, ceiling: 95 };

function strengthPercentile(ratio: number, thresholds: [number, number, number]): number {
  const [novice, intermediate, advanced] = thresholds;
  const { beginner, novice: nP, intermediate: iP, advanced: aP, ceiling } = BAND_PERCENTILES;
  const between = (value: number, low: number, high: number, from: number, to: number) =>
    Math.round(from + ((value - low) / (high - low)) * (to - from));

  if (ratio <= 0) return 0;
  if (ratio < novice) return between(ratio, 0, novice, beginner, nP);
  if (ratio < intermediate) return between(ratio, novice, intermediate, nP, iP);
  if (ratio < advanced) return between(ratio, intermediate, advanced, iP, aP);
  return Math.min(ceiling, between(ratio, advanced, advanced * 2, aP, ceiling));
}

function strengthStandingFor(
  exerciseName: string,
  weightKg: number,
  reps: number,
  bodyWeightKg: number,
  sex: string | undefined,
): { level: StrengthLevel; percentile: number } | null {
  const standard = STRENGTH_STANDARDS.find(
    (entry) => entry.match.test(exerciseName) && !entry.exclude?.test(exerciseName),
  );
  if (!standard) return null;
  if (!Number.isFinite(bodyWeightKg) || bodyWeightKg <= 0 || weightKg <= 0) return null;

  // Dumbbell loads are stored per hand; published standards are quoted for the
  // total moved. Comparing 20kg-per-hand against a 40kg-total threshold cost
  // roughly a full band -- a dumbbell press that is genuinely intermediate read
  // as novice.
  const totalKg = isPerHandLoad(exerciseName, implementForExerciseName(exerciseName))
    ? weightKg * 2
    : weightKg;
  const ratio = estimatedOneRepMaxKg(totalKg, reps) / bodyWeightKg;
  // An unstated sex takes the female thresholds -- the lower bar, so an
  // unknown never inflates someone's standing.
  const thresholds = sex === "male" ? standard.male : standard.female;
  const [novice, intermediate, advanced] = thresholds;

  const level: StrengthLevel =
    ratio >= advanced
      ? "Advanced"
      : ratio >= intermediate
        ? "Intermediate"
        : ratio >= novice
          ? "Novice"
          : "Beginner";

  return { level, percentile: strengthPercentile(ratio, thresholds) };
}

// This week's tonnage against the weeks they actually trained.
//
// Deliberately compared against the user's own past rather than other people:
// cumulative volume mostly measures how long someone has been using the app,
// so ranking one user's total against another's would say more about tenure
// than training. Their own trend is a real signal and needs no one else's data.
//
// Weeks with no training are left out of the average. Counting them would
// flatter every comparison -- a fortnight off would make an ordinary week look
// like a personal best.
function weeklyVolumeTrend(
  weeks: { weekStartMs: number; volumeKg: number }[],
): { percent: number; direction: "up" | "down"; against: string } | null {
  if (weeks.length < 2) return null;
  const current = weeks[weeks.length - 1]!;
  if (current.volumeKg <= 0) return null;

  const priorTrained = weeks.slice(0, -1).filter((week) => week.volumeKg > 0);
  // One earlier week is a comparison, not an average -- not enough to call
  // anything "usual".
  if (priorTrained.length < 2) return null;

  const average = priorTrained.reduce((sum, week) => sum + week.volumeKg, 0) / priorTrained.length;
  return compareToAverage(current.volumeKg, average, "usual week");
}

// The same comparison between sessions, for someone who hasn't been here long
// enough to have weeks to compare. Two sessions is the earliest point at which
// any honest self-comparison exists -- before that there is nothing to measure
// against, and a number would have to be invented.
function sessionVolumeTrend(
  workoutHistory: WorkoutHistoryEntry[],
  fallbackBodyWeightKg?: number,
): { percent: number; direction: "up" | "down"; against: string } | null {
  const volumes = workoutHistory.map((entry) => entryVolumeKg(entry, fallbackBodyWeightKg));
  if (volumes.length < 2) return null;
  const [latest, ...prior] = volumes;
  if (!latest || latest <= 0) return null;
  const average = prior.reduce((sum, value) => sum + value, 0) / prior.length;
  return compareToAverage(latest, average, "usual session");
}

function compareToAverage(
  current: number,
  average: number,
  against: string,
): { percent: number; direction: "up" | "down"; against: string } | null {
  if (average <= 0) return null;
  const change = Math.round(((current - average) / average) * 100);
  // Inside a few percent it's noise, and calling it a trend would be dishonest.
  if (Math.abs(change) < 5) return null;
  return { percent: Math.abs(change), direction: change > 0 ? "up" : "down", against };
}

// Something everyday to picture, because "12,600 kg" alone means nothing to
// most people. Picks the largest reference the total clears, so the count
// stays small and legible rather than "180 washing machines".
const VOLUME_COMPARISONS: { kg: number; one: string; many: string }[] = [
  { kg: 70, one: "washing machine", many: "washing machines" },
  { kg: 400, one: "grand piano", many: "grand pianos" },
  { kg: 600, one: "horse", many: "horses" },
  { kg: 1400, one: "small car", many: "small cars" },
  { kg: 5000, one: "elephant", many: "elephants" },
  { kg: 12000, one: "city bus", many: "city buses" },
  { kg: 180000, one: "blue whale", many: "blue whales" },
];

function volumeComparison(totalKg: number): string | null {
  const reference = [...VOLUME_COMPARISONS].reverse().find((entry) => totalKg >= entry.kg);
  if (!reference) return null;
  const count = totalKg / reference.kg;
  const rounded = count >= 10 ? String(Math.round(count)) : count.toFixed(1).replace(/\.0$/, "");
  return `about ${rounded} ${rounded === "1" ? reference.one : reference.many}`;
}

type Badge = {
  id: string;
  icon: string;
  name: string;
  requirement: string;
  value: number;
  target: number;
};

type BadgeStats = {
  totalWorkouts: number;
  totalVolumeKg: number;
  // The BEST streak ever reached, not the current one. An achievement records
  // something that happened; missing a week later doesn't unmake it, and a
  // badge that can vanish isn't an achievement.
  bestStreakWeeks: number;
  totalAdvances: number;
  perfectWeeks: number;
  bestPerfectWeekRun: number;
};

// Four ladders on purpose, so there is always something within reach whoever
// you are: showing up, tonnage moved, staying consistent week to week, and
// weight actually earned through the progression. Someone training light but
// never missing a week has a ladder of their own, and so does someone
// infrequent but strong.
//
// Order is fixed rather than earned-first: a badge grid is a collection, and
// collections are learned by position.
function buildBadges(stats: BadgeStats): Badge[] {
  const { totalWorkouts, totalVolumeKg, bestStreakWeeks, totalAdvances, perfectWeeks, bestPerfectWeekRun } =
    stats;
  return [
    { id: "first", icon: "🥇", name: "First One", requirement: "1 session", value: totalWorkouts, target: 1 },
    { id: "ten", icon: "🔥", name: "Regular", requirement: "10 sessions", value: totalWorkouts, target: 10 },
    { id: "fifty", icon: "💪", name: "Committed", requirement: "50 sessions", value: totalWorkouts, target: 50 },
    { id: "hundred", icon: "🏛️", name: "Century", requirement: "100 sessions", value: totalWorkouts, target: 100 },

    { id: "tonne", icon: "🪨", name: "One Tonne", requirement: "1,000 kg", value: totalVolumeKg, target: 1000 },
    { id: "tenTonnes", icon: "🚚", name: "Ten Tonnes", requirement: "10,000 kg", value: totalVolumeKg, target: 10000 },
    { id: "fiftyTonnes", icon: "🐘", name: "Fifty Tonnes", requirement: "50,000 kg", value: totalVolumeKg, target: 50000 },
    { id: "hundredTonnes", icon: "🌍", name: "Hundred Tonnes", requirement: "100,000 kg", value: totalVolumeKg, target: 100000 },

    { id: "streak2", icon: "📅", name: "Two Weeks", requirement: "2 weeks in a row", value: bestStreakWeeks, target: 2 },
    { id: "streak4", icon: "🗓️", name: "One Month", requirement: "4 weeks in a row", value: bestStreakWeeks, target: 4 },
    { id: "streak12", icon: "🍀", name: "One Quarter", requirement: "12 weeks in a row", value: bestStreakWeeks, target: 12 },
    { id: "streak26", icon: "👑", name: "Half a Year", requirement: "26 weeks in a row", value: bestStreakWeeks, target: 26 },

    { id: "load1", icon: "⬆️", name: "Earned It", requirement: "1 load increase", value: totalAdvances, target: 1 },
    { id: "load10", icon: "🎯", name: "Ten Up", requirement: "10 load increases", value: totalAdvances, target: 10 },
    { id: "load25", icon: "🚀", name: "Twenty-Five Up", requirement: "25 load increases", value: totalAdvances, target: 25 },

    // "Perfect week" = every session you set out to do that week, actually
    // done. Judged against the target in force at the time, not today's.
    { id: "perfect", icon: "✅", name: "Perfect Week", requirement: "Every session in one week", value: perfectWeeks, target: 1 },
    { id: "perfect4", icon: "🏆", name: "Four Perfect Weeks", requirement: "4 perfect weeks in a row", value: bestPerfectWeekRun, target: 4 },
  ];
}

// Whether the badge's condition is met by the CURRENT numbers. Says nothing
// about whether it was met in the past -- see EarnedBadges for that.
function isBadgeEarned(badge: Badge): boolean {
  return badge.value >= badge.target;
}

// Badge id -> the day it was first earned. Once a badge is in here it stays
// earned forever, regardless of what the live numbers do afterwards.
//
// The maxima-based conditions already stop a badge un-earning in the ordinary
// cases, but they can't cover everything: bodyweight volume on history logged
// before per-session bodyweight was recorded is recomputed from the current
// profile weight, so losing weight could nudge a tonnage total back below a
// threshold already passed. Sealing the result removes that whole class of
// problem instead of chasing each instance.
type EarnedBadges = Record<string, string>;

function weeklyTargetForProfile(profile: Record<string, string>): number {
  return Math.max(1, Number(profile.frequency) || 3);
}

function computeBadgeStats(
  workoutHistory: WorkoutHistoryEntry[],
  exerciseProgress: Record<string, ExerciseProgress>,
  profile: Record<string, string>,
): BadgeStats {
  const perfect = perfectWeekKeys(workoutHistory, weeklyTargetForProfile(profile));
  return {
    totalWorkouts: workoutHistory.length,
    totalVolumeKg: workoutHistory.reduce(
      (sum, entry) => sum + entryVolumeKg(entry, Number(profile.weight)),
      0,
    ),
    bestStreakWeeks: longestConsecutiveWeeks(trainedWeekKeys(workoutHistory)),
    totalAdvances: Object.values(exerciseProgress).reduce(
      (sum, entry) => sum + (entry.totalAdvances ?? 0),
      0,
    ),
    perfectWeeks: perfect.size,
    bestPerfectWeekRun: longestConsecutiveWeeks(perfect),
  };
}

// Records any newly met badge against today's date. Returns null when nothing
// changed, so the caller can skip a state update that would otherwise loop:
// this runs in an effect keyed on the very state it writes.
function sealNewlyEarnedBadges(badges: Badge[], alreadyEarned: EarnedBadges): EarnedBadges | null {
  const newlyEarned = badges.filter((badge) => isBadgeEarned(badge) && !alreadyEarned[badge.id]);
  if (newlyEarned.length === 0) return null;
  const today = new Date().toISOString();
  const next = { ...alreadyEarned };
  for (const badge of newlyEarned) next[badge.id] = today;
  return next;
}

// The unearned badge closest to completion -- the one worth putting a progress
// bar against, so the grid always points at a concrete next step.
// Takes the unearned badges and returns whichever is closest to completion --
// the one worth putting a progress bar against. Callers decide what "unearned"
// means, since a sealed badge stays earned whatever the live numbers say.
function nextBadge(unearned: Badge[]): Badge | null {
  if (unearned.length === 0) return null;
  return unearned.reduce((closest, badge) =>
    badge.value / badge.target > closest.value / closest.target ? badge : closest,
  );
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

// Which four-week training block the user is in, counting from their first
// logged session. Unlike getMesocycleWeek's 1-4 position, this only ever
// increases.
//
// Main lifts rotate on this rather than per session. Progression is tracked per
// exercise name, so a squat that changes every session never advances; a squat
// that changes every four weeks is a training block, which is how a programme
// is meant to be written.
function mesocycleBlockIndex(workoutHistory: WorkoutHistoryEntry[]): number {
  const firstWorkout = workoutHistory[workoutHistory.length - 1];
  if (!firstWorkout) return 0;
  const firstMs = new Date(firstWorkout.date).getTime();
  if (Number.isNaN(firstMs)) return 0;
  return Math.max(0, Math.floor((Date.now() - firstMs) / (28 * 24 * 60 * 60 * 1000)));
}

// Most-recent-first, matching workoutHistory's own order -- feeds determineSplitDay's
// least-recently-trained balancing.
function recentSplitDaysFromHistory(workoutHistory: WorkoutHistoryEntry[]): SplitDay[] {
  return workoutHistory.map((entry) => entry.splitDay).filter((day): day is SplitDay => Boolean(day));
}

function computeReadiness(workoutHistory: WorkoutHistoryEntry[], checkIn?: DailyCheckIn | null): ReadinessInfo {
  // Today's check-in is a direct report of how the user feels, so it outranks
  // the time-since-last-session guess whenever it exists.
  const today = todaysCheckIn(checkIn ?? null);
  if (today) {
    const score = Math.round(checkInScore(today) * 100);
    if (score >= 75) {
      return { score, title: "Feeling strong", hint: "Great check-in — today’s session stands as planned." };
    }
    if (score >= 50) {
      return { score, title: "Good readiness", hint: "You’re ready for the planned session." };
    }
    if (score >= 30) {
      return { score, title: "Running low", hint: "We’ve eased today’s load to match how you feel." };
    }
    return { score, title: "Needs recovery", hint: "Lighter session today — recovery beats grinding." };
  }

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
  // Only used for sessions logged before bodyweight was recorded on the
  // entry itself; newer entries carry their own.
  currentBodyWeightKg?: number,
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
        (exerciseSum, item) =>
          exerciseSum + exerciseVolumeKg(item, entry.bodyWeightKg ?? currentBodyWeightKg),
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
        .map(([name, entry]) => `${name} ${entry.weightKg}kg x${entry.repsLow}-${entry.repsHigh}`)
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
            profile: { goal: profile.goal, sex: profile.sex },
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
const budgetOptions = [
  { label: "Budget-friendly", value: "budget" },
  { label: "Moderate", value: "moderate" },
  { label: "No limit", value: "any" },
];
const mealStyleOptions = [
  { label: "Cook it myself", value: "cook" },
  { label: "Ready-made", value: "readymade" },
  { label: "Mix of both", value: "mixed" },
];

type SavedDietPlan = {
  dietaryStyle: string;
  mealsPerDay: string;
  prepTime: string;
  budget: string;
  mealStyle: string;
  avoid: string;
  allergies?: string;
  days: DietPlanResult[];
  generatedAt: string;
  isFallback: boolean;
  // The targets this plan's meals were actually sized against. Kept so the
  // screen can tell the user their plan has gone stale after they edit their
  // weight/height/age/goal, instead of silently showing old meals under a
  // freshly recalculated header. Optional: plans saved before this existed
  // simply skip the staleness check.
  calorieTarget?: number;
  proteinTarget?: number;
};

function MealDetailModal({
  meal,
  prepTime,
  budget,
  mealStyle,
  onClose,
}: {
  meal: DietPlanMeal | null;
  prepTime: string;
  budget: string;
  mealStyle: string;
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
              budget,
              mealStyle,
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
  }, [meal, prepTime, budget, mealStyle]);

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
  const [budget, setBudget] = useState(savedPlan?.budget ?? "any");
  const [mealStyle, setMealStyle] = useState(savedPlan?.mealStyle ?? "cook");
  const [avoid, setAvoid] = useState(savedPlan?.avoid ?? "");
  const [allergies, setAllergies] = useState(savedPlan?.allergies ?? "");
  const [stage, setStage] = useState<"form" | "loading" | "result">(hasSavedWeek ? "result" : "form");
  const [days, setDays] = useState<DietPlanResult[]>(hasSavedWeek ? savedPlan!.days : []);
  const [generatedAt, setGeneratedAt] = useState(savedPlan?.generatedAt ?? "");
  const [isFallback, setIsFallback] = useState(savedPlan?.isFallback ?? false);
  const [selectedMeal, setSelectedMeal] = useState<DietPlanMeal | null>(null);
  const [builtForCalories, setBuiltForCalories] = useState(savedPlan?.calorieTarget);
  const [builtForProtein, setBuiltForProtein] = useState(savedPlan?.proteinTarget);

  const calorieTarget = dailyCalorieTargetKcal(profile);
  const proteinTarget = dailyProteinTargetGrams(profile);
  const weeksToGoal = weeksToGoalWeight(profile);
  const daysSince = generatedAt ? daysSinceDate(generatedAt) : 0;
  const activeDayIndex = days.length ? daysSince % days.length : 0;
  const cycleComplete = days.length > 0 && daysSince >= days.length;
  // Editing weight/height/age/goal/diet mode moves the targets immediately, but
  // the meals on screen were written for the old ones. Flag that rather than
  // showing stale meals under a freshly recalculated header. Small drifts are
  // ignored so a 1kg weight edit doesn't nag about a rebuild.
  const targetsDrifted =
    days.length > 0 &&
    builtForCalories !== undefined &&
    builtForProtein !== undefined &&
    (Math.abs(calorieTarget - builtForCalories) >= 100 || Math.abs(proteinTarget - builtForProtein) >= 10);

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
          budget,
          mealStyle,
          avoid: avoid.trim().slice(0, 140),
          allergies: allergies.trim().slice(0, 140),
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
      setBuiltForCalories(calorieTarget);
      setBuiltForProtein(proteinTarget);
      onSave({
        dietaryStyle,
        mealsPerDay,
        prepTime,
        budget,
        mealStyle,
        avoid,
        allergies,
        days: data.days,
        generatedAt: nowIso,
        isFallback: false,
        calorieTarget,
        proteinTarget,
      });
    } catch {
      const nowIso = new Date().toISOString();
      setDays(fallbackDietWeek);
      setGeneratedAt(nowIso);
      setIsFallback(true);
      setBuiltForCalories(calorieTarget);
      setBuiltForProtein(proteinTarget);
      onSave({
        dietaryStyle,
        mealsPerDay,
        prepTime,
        budget,
        mealStyle,
        avoid,
        allergies,
        days: fallbackDietWeek,
        generatedAt: nowIso,
        isFallback: true,
        calorieTarget,
        proteinTarget,
      });
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
              {/* The pace answer is otherwise invisible -- this is where it
                  turns into something the user can weigh up. */}
              {weeksToGoal !== null ? (
                <Text style={styles.dietPaceEstimate}>
                  At this pace, about {weeksToGoal} week{weeksToGoal === 1 ? "" : "s"} to reach{" "}
                  {profile.goalWeight} kg — an estimate, and bodies rarely move in a straight line.
                </Text>
              ) : null}
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

            <Text style={styles.dietGroupLabel}>BUDGET</Text>
            <View style={styles.dietChipRow}>
              {budgetOptions.map((option) => (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: budget === option.value }}
                  onPress={() => setBudget(option.value)}
                  style={[styles.dietChip, budget === option.value && styles.dietChipSelected]}
                >
                  <Text style={[styles.dietChipText, budget === option.value && styles.dietChipTextSelected]}>
                    {option.label}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Text style={styles.dietGroupLabel}>COOKING STYLE</Text>
            <View style={styles.dietChipRow}>
              {mealStyleOptions.map((option) => (
                <Pressable
                  key={option.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: mealStyle === option.value }}
                  onPress={() => setMealStyle(option.value)}
                  style={[styles.dietChip, mealStyle === option.value && styles.dietChipSelected]}
                >
                  <Text style={[styles.dietChipText, mealStyle === option.value && styles.dietChipTextSelected]}>
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

            {/* Asked apart from dislikes on purpose. Skipping a disliked food
                makes a meal unappealing; skipping an allergen is a different
                order of consequence, and the endpoint states it far more
                forcefully than a preference. */}
            <Text style={styles.dietGroupLabel}>ALLERGIES (OPTIONAL)</Text>
            <TextInput
              value={allergies}
              onChangeText={setAllergies}
              placeholder="e.g. peanuts, dairy"
              placeholderTextColor="#5B6058"
              style={styles.dietAvoidInput}
              maxLength={140}
            />
            <Text style={styles.dietAllergyNote}>
              Anything listed here is excluded outright, along with foods it’s commonly
              cross-contaminated with. Always check labels yourself — this is a meal suggestion,
              not a safety guarantee.
            </Text>

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

            {targetsDrifted ? (
              <Text style={styles.dietCycleNote}>
                Your profile changed — these meals were built for {builtForCalories} kcal ·{" "}
                {builtForProtein}g protein. Rebuild to match your new {calorieTarget} kcal ·{" "}
                {proteinTarget}g target.
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

      <MealDetailModal
        meal={selectedMeal}
        prepTime={prepTime}
        budget={budget}
        mealStyle={mealStyle}
        onClose={() => setSelectedMeal(null)}
      />
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
          memory: summarizeCoachMemory(workoutHistory, exerciseProgress, Number(profile.weight)),
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
  // Top of the prescribed rep range, shown alongside `reps` (the working
  // target) so the trainee can see the whole range they're working within --
  // e.g. "8-12" -- rather than a single number that hides where progression
  // is actually heading. Absent for timed holds, which have no range.
  repsHigh?: string;
  // Which real-world implement this exercise loads, so weights only ever land
  // on values that exist in a gym. Absent means "not weighted".
  implement?: LoadableImplement;
  // True when `weight` is the load in each hand (two dumbbells) rather than
  // the total being moved.
  weightPerHand?: boolean;
  // Set when `reps` is a per-side target -- "leg" for lunges and other
  // single-leg work, "side" for single-arm work. Absent means both sides
  // together, the normal case.
  repsPerSide?: "leg" | "side";
  // True when `reps` is a duration in seconds rather than a count. Carried
  // explicitly because it cannot be inferred from the name: a front rack carry
  // and a wall sit are both held, and neither says "plank".
  isHold?: boolean;
  tempo: string;
  phases: string[];
  pose?: ExercisePose;
  // What the 3D demo should draw in the hands. The library implement, not the
  // loadable one: implementForExerciseName calls a medicine ball a "dumbbell"
  // so its weight snaps sensibly, and the demo must not inherit that.
  demoImplement?: ViewerImplement;
  // How to perform it, in words. Carries the exercise until footage exists.
  cue?: string;
  // Only present for exercises sourced from the live MuscleWiki catalog --
  // needed to look up "similar exercise" alternatives. Absent for the
  // built-in fallback roster, which has no such data to search by.
  catalogMeta?: {
    externalId: number;
    movementPattern: MovementPattern;
    primaryMuscle: PrimaryMuscle;
  };
};


const workoutExercises: WorkoutExercise[] = [
  {
    name: "Goblet Squat",
    target: "Lower body · Compound",
    weight: "16 kg",
    reps: "10",
    tempo: "3–1–1",
    phases: ["LOWER", "HOLD", "DRIVE"],
    pose: exercisePoses.squat,
  },
  {
    name: "Dumbbell Press",
    target: "Chest · Compound",
    weight: "12 kg",
    reps: "10",
    tempo: "2–1–1",
    phases: ["LOWER", "PAUSE", "PRESS"],
    pose: exercisePoses.bench,
  },
  {
    name: "Seated Row",
    target: "Back · Controlled",
    weight: "25 kg",
    reps: "12",
    tempo: "2–1–2",
    phases: ["REACH", "PULL", "RETURN"],
    pose: exercisePoses.bentRow,
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
// Recovery is spent on everything, not just training. Someone lifting and
// carrying all day arrives at the gym closer to their ceiling than someone who
// sat down for eight hours, so the same session costs them more.
//
// Only manual work is discounted, and only by one set. Being on your feet is
// not the same as loaded physical labour, and the people doing that work are
// often the better conditioned -- which is exactly why this stays modest
// rather than trying to model their recovery in detail.
const ACTIVITY_SET_ADJUSTMENT: Record<string, number> = {
  sedentary: 0,
  light: 0,
  active: 0,
  physical: -1,
};

function setCountForProfile(
  profile: Record<string, string>,
  adjustment?: CoachScenario | null,
  isDeload?: boolean,
  checkIn?: DailyCheckIn | null,
): number {
  const baseSetCount = BASE_SET_COUNT_BY_FREQUENCY[profile.frequency ?? "3"] ?? 3;
  const densityBonus = profile.goal === "fat-loss" || profile.goal === "fitness" ? 1 : 0;
  const experienceBonus = EXPERIENCE_SET_BONUS[profile.experience ?? ""] ?? 0;
  const activityAdjustment = ACTIVITY_SET_ADJUSTMENT[profile.activity ?? ""] ?? 0;
  const reduction =
    (adjustment === "tired" ? 1 : 0) +
    (isDeload ? 1 : 0) +
    readinessSetPenalty(checkIn ?? null, profile.goal);
  return Math.max(2, baseSetCount + densityBonus + experienceBonus + activityAdjustment - reduction);
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
  // A stated goal weight outranks the training goal, because it is the more
  // direct statement of intent. Someone training for general fitness who says
  // they want to be 8kg lighter needs a deficit -- inferring "recomp" from the
  // training goal alone left their target weight doing nothing at all.
  const currentKg = Number(profile.weight);
  const goalKg = Number(profile.goalWeight);
  if (Number.isFinite(currentKg) && Number.isFinite(goalKg) && goalKg > 0) {
    // Under a couple of kilos is inside normal daily fluctuation, not a goal.
    if (Math.abs(goalKg - currentKg) >= 2) return goalKg < currentKg ? "cut" : "bulk";
  }

  return profile.goal === "muscle" ? "bulk" : profile.goal === "fat-loss" ? "cut" : "recomp";
}

const REFERENCE_HEIGHT_CM = 175;
const REFERENCE_AGE_YEARS = 30;

// Reads the onboarding body-measurement answers, falling back to the same
// reference values the interview defaults to when an answer is missing or
// unparseable, so every downstream target degrades gracefully instead of
// producing NaN.
function readBodyMetrics(profile: Record<string, string>) {
  const rawWeight = Number(profile.weight);
  const rawHeight = Number(profile.height);
  const rawAge = Number(profile.age);
  return {
    weightKg: Number.isFinite(rawWeight) && rawWeight > 0 ? rawWeight : REFERENCE_BODY_WEIGHT_KG,
    heightCm: Number.isFinite(rawHeight) && rawHeight > 0 ? rawHeight : REFERENCE_HEIGHT_CM,
    ageYears: Number.isFinite(rawAge) && rawAge > 0 ? rawAge : REFERENCE_AGE_YEARS,
    // Deliberately three-state, matching how createWorkout() already treats sex:
    // a profile with no usable answer is "unknown", not silently female. Testing
    // `=== "male"` alone would quietly apply the female constant (a systematic
    // ~240 kcal/day error) to any legacy, partially-restored, or differently-cased
    // profile, with nothing on screen indicating it happened.
    sex: profile.sex === "male" ? "male" : profile.sex === "female" ? "female" : "unknown",
  } as const;
}

// Mifflin-St Jeor resting metabolic rate -- the standard clinical estimate,
// and the reason height and age are collected during onboarding at all.
// The sex constant is worth ~166 kcal at rest (~240 after the activity
// multiplier), so an unknown sex splits the difference rather than guessing:
// that halves the worst-case error instead of biasing every unknown profile
// in one direction.
const MIFFLIN_SEX_CONSTANT = { male: 5, female: -161, unknown: -78 } as const;

function restingMetabolicRateKcal(profile: Record<string, string>): number {
  const { weightKg, heightCm, ageYears, sex } = readBodyMetrics(profile);
  return 10 * weightKg + 6.25 * heightCm - 5 * ageYears + MIFFLIN_SEX_CONSTANT[sex];
}

// Training frequency is the only activity signal the interview collects, so
// it drives the activity multiplier. These sit in the usual sedentary-to-very-
// active band; they deliberately stay conservative since the answer only
// describes planned training, not overall daily movement.
// Daily life first, training on top -- in that order, because that is the
// order of magnitude. Deriving this from training frequency alone gave a
// builder and an office worker who both train four times a week identical
// calorie targets, when their jobs can separate them by several hundred
// kilocalories a day.
const DAILY_ACTIVITY_BASE: Record<string, number> = {
  sedentary: 1.2,
  light: 1.3,
  active: 1.42,
  physical: 1.55,
};

function activityMultiplier(profile: Record<string, string>): number {
  // An unanswered activity question falls back to "light", which with three
  // sessions a week reproduces the old 1.45 exactly -- existing users keep the
  // target they already had until they answer.
  const base = DAILY_ACTIVITY_BASE[profile.activity ?? ""] ?? DAILY_ACTIVITY_BASE.light!;
  const daysPerWeek = Number(profile.frequency);
  const trainingBump = Number.isFinite(daysPerWeek) ? Math.min(0.25, daysPerWeek * 0.05) : 0.15;
  // Capped at the top of the standard range; nothing above this is a
  // multiplier, it's a data-entry error.
  return Math.min(1.9, base + trainingBump);
}

// Standard sports-nutrition range for active adults is roughly 1.6-2.2g of
// protein per kg of body weight; this is a general heuristic, not medical
// or dietary advice. Protein stays high across all three modes -- a cut
// needs it most to preserve muscle in a deficit, recomp needs it to build
// while at maintenance, and bulk needs it to actually use the surplus.
function dailyProteinTargetGrams(profile: Record<string, string>): number {
  const { weightKg, heightCm } = readBodyMetrics(profile);
  // Protein needs scale with lean mass, not total mass, so past roughly BMI 30
  // the usual g/kg factors overshoot badly. Standard practice is to dose off an
  // adjusted body weight instead -- here, the weight that would put this person
  // at BMI 27.5, plus a quarter of the excess above it. This is the one place
  // height legitimately enters a protein target (via BMI).
  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  const referenceWeightKg = 27.5 * heightM * heightM;
  const dosingWeightKg =
    bmi > 30 ? referenceWeightKg + (weightKg - referenceWeightKg) * 0.25 : weightKg;
  const mode = inferDietMode(profile);
  const factor = mode === "cut" ? 2.2 : mode === "recomp" ? 2.0 : 1.8;
  return Math.round(dosingWeightKg * factor);
}

// Total daily energy expenditure (Mifflin-St Jeor RMR x activity), then shifted
// by diet mode. This is a general heuristic to size a sample meal plan, not
// medical or dietary advice. Recomp sits at maintenance -- no surplus or
// deficit -- relying on the higher protein target above to do the work instead.
// How hard to push, when the user has said. A steady rate is roughly 0.5% of
// bodyweight a week; steady/slow/fast scale around that. Without an answer the
// shift stays exactly where it was before this existed.
const DIET_PACE_SHIFT: Record<string, { cut: number; bulk: number }> = {
  slow: { cut: 0.9, bulk: 1.06 },
  steady: { cut: 0.82, bulk: 1.12 },
  fast: { cut: 0.75, bulk: 1.18 },
};

function dailyCalorieTargetKcal(profile: Record<string, string>): number {
  const maintenance = restingMetabolicRateKcal(profile) * activityMultiplier(profile);
  const mode = inferDietMode(profile);
  const pace = DIET_PACE_SHIFT[profile.dietPace ?? ""] ?? DIET_PACE_SHIFT.steady!;
  const factor = mode === "cut" ? pace.cut : mode === "bulk" ? pace.bulk : 1;
  // Floor at a conservative minimum so an aggressive cut on a small frame can
  // never render a dangerously low number as if it were a recommendation.
  const target = Math.max(1200, maintenance * factor);
  return Math.round(target / 10) * 10;
}

// Weeks to the stated goal weight at the current calorie shift, so the pace
// choice has a visible consequence instead of being an abstract preference.
// Null whenever the arithmetic can't say anything honest: no target set,
// already there, or a target that the chosen direction moves away from.
function weeksToGoalWeight(profile: Record<string, string>): number | null {
  const currentKg = Number(profile.weight);
  const goalKg = Number(profile.goalWeight);
  if (!Number.isFinite(currentKg) || !Number.isFinite(goalKg) || goalKg <= 0) return null;

  const differenceKg = goalKg - currentKg;
  if (Math.abs(differenceKg) < 1) return null;

  const mode = inferDietMode(profile);
  if (mode === "recomp") return null;
  // Losing weight on a surplus, or gaining on a deficit, has no answer.
  if ((mode === "cut" && differenceKg > 0) || (mode === "bulk" && differenceKg < 0)) return null;

  const maintenance = restingMetabolicRateKcal(profile) * activityMultiplier(profile);
  const dailyGapKcal = Math.abs(maintenance - dailyCalorieTargetKcal(profile));
  if (dailyGapKcal < 50) return null;

  // ~7700 kcal per kilogram of body mass -- a textbook approximation, and
  // treated as one: the figure is shown as "about".
  const weeks = (Math.abs(differenceKg) * 7700) / (dailyGapKcal * 7);
  return weeks >= 1 ? Math.round(weeks) : 1;
}

// A real gym does not stock every kilogram, so an arithmetically-derived
// number like "27 kg" is worse than useless -- there is no 27kg dumbbell to
// pick up. What is actually loadable depends entirely on the implement:
// dumbbells come in fixed castings, a barbell is a fixed bar plus plates
// added in PAIRS (so the smallest real change is twice the smallest plate),
// and a selectorized machine moves one stack plate at a time.
type LoadableImplement = "dumbbell" | "kettlebell" | "barbell" | "machine" | "other";

// Single-kg castings up to 10, then the 2kg jumps every commercial rack has,
// then 2.5kg jumps once the weights get heavy enough that nobody stocks
// finer steps.
const DUMBBELL_LADDER_KG = [
  1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30, 32.5, 35, 37.5, 40, 42.5,
  45, 47.5, 50, 55, 60,
];

// Kettlebells are cast in a much coarser ladder than dumbbells.
const KETTLEBELL_LADDER_KG = [4, 6, 8, 12, 16, 20, 24, 28, 32, 36, 40];

// Standard olympic bar, and plates loaded in pairs -- the smallest commonly
// stocked plate is 1.25kg a side, making 2.5kg the smallest honest jump.
// You cannot go below the empty bar, so that is the floor.
const BARBELL_BAR_KG = 20;
const BARBELL_INCREMENT_KG = 2.5;

// Selectorized stacks move a whole plate at a time; 5kg is the common plate.
const MACHINE_INCREMENT_KG = 5;

function loadableWeightOptions(implement: LoadableImplement): number[] {
  if (implement === "dumbbell") return DUMBBELL_LADDER_KG;
  if (implement === "kettlebell") return KETTLEBELL_LADDER_KG;
  const list: number[] = [];
  if (implement === "barbell") {
    for (let kg = BARBELL_BAR_KG; kg <= 200; kg += BARBELL_INCREMENT_KG) list.push(kg);
    return list;
  }
  if (implement === "machine") {
    for (let kg = MACHINE_INCREMENT_KG; kg <= 150; kg += MACHINE_INCREMENT_KG) list.push(kg);
    return list;
  }
  for (let kg = 2; kg <= 100; kg += 2) list.push(kg);
  return list;
}

// Nearest weight that actually exists on the gym floor for this implement.
function snapToLoadableWeight(kg: number, implement: LoadableImplement): number {
  const options = loadableWeightOptions(implement);
  return options.reduce((best, option) => (Math.abs(option - kg) < Math.abs(best - kg) ? option : best));
}

// The next real rung up -- what "add a little weight" means in practice.
// Progression has to move between rungs that exist, not by a flat +1kg that
// would land on weights nobody can load.
function nextLoadableWeight(kg: number, implement: LoadableImplement): number {
  const options = loadableWeightOptions(implement);
  return options.find((option) => option > kg) ?? options[options.length - 1] ?? kg;
}

function implementForExerciseName(name: string): LoadableImplement {
  if (/barbell|smith/i.test(name)) return "barbell";
  if (/kettlebell/i.test(name)) return "kettlebell";
  if (/cable|machine|pulldown|seated row|pec deck|leg press|leg curl|leg extension/i.test(name)) {
    return "machine";
  }
  return "dumbbell";
}

// The catalog's `equipment` is MuscleWiki's own category string, which is the
// more reliable signal when present; the name is the fallback.
function implementForCatalogExercise(equipment: string, name: string): LoadableImplement {
  const category = equipment.toLowerCase();
  if (category.includes("barbell") || category.includes("smith")) return "barbell";
  if (category.includes("dumbbell")) return "dumbbell";
  if (category.includes("kettlebell")) return "kettlebell";
  if (category.includes("cable") || category.includes("machine")) return "machine";
  return implementForExerciseName(name);
}

// A dumbbell number is what goes in EACH hand, not the total being moved --
// "7 kg" on a curl means picking up two 7kg dumbbells. That distinction has to
// be on screen or the trainee either halves their load or doubles it.
// Goblet-style holds are the exception: one bell, both hands on it. Barbells,
// machines and kettlebells are single-implement, so they carry no such note.
function isPerHandLoad(name: string, implement: LoadableImplement): boolean {
  return implement === "dumbbell" && !/goblet/i.test(name);
}

// Unilateral work prescribes reps PER SIDE, not split across both -- 8 reps on
// a lunge means 8 on each leg. Which word to use depends on the limb doing
// the work, so a one-arm row doesn't say "per leg".
function perSideUnitLabel(name: string, primaryMuscle?: PrimaryMuscle): "leg" | "side" | null {
  if (/lunge|step[- ]?up|split squat|pistol|bulgarian|curtsy|single[- ]?leg/i.test(name)) return "leg";
  if (/one[- ]?arm|single[- ]?arm/i.test(name)) return "side";
  if (!primaryMuscle) return null;
  // Catalog exercises flagged unilateral whose name doesn't match either
  // pattern above -- fall back to the muscle being worked.
  return ["quads", "hamstrings", "glutes", "calves"].includes(primaryMuscle) ? "leg" : "side";
}

function scaledStartingWeightLabel(
  baseKg: number,
  bodyWeightKg: number,
  implement: LoadableImplement,
): string {
  const factor =
    Number.isFinite(bodyWeightKg) && bodyWeightKg > 0
      ? Math.min(1.3, Math.max(0.75, bodyWeightKg / REFERENCE_BODY_WEIGHT_KG))
      : 1;
  return `${snapToLoadableWeight(baseKg * factor, implement)} kg`;
}

// Classic strength/hypertrophy/endurance rep ranges, picked per training
// goal instead of one number for everyone -- strength trains low-rep/heavy,
// hypertrophy (muscle) trains moderate reps, fat-loss/fitness train
// higher-rep for metabolic density. Athletic work sits between strength and
// hypertrophy: low enough to move fast against a meaningful load, high enough
// to accumulate quality reps rather than grinding near-maximal singles.
const GOAL_REP_TARGET: Record<string, number> = {
  strength: 5,
  athletic: 6,
  muscle: 10,
  "fat-loss": 14,
  fitness: 12,
  // Legacy goal, no longer offered. Left in so anyone who chose it keeps the
  // programme they already had until they pick something else.
  health: 10,
};

// Rest between sets follows the same logic: strength needs full recovery to
// keep the weight heavy, fat-loss/fitness keep rest short to stay in a
// higher heart-rate, higher-density zone. Athletic training rests nearly as
// long as strength: a fast rep done tired is just a slow rep, and the point
// of the session is the speed.
const GOAL_REST_SECONDS: Record<string, number> = {
  strength: 120,
  athletic: 100,
  muscle: 75,
  "fat-loss": 40,
  fitness: 45,
  health: 60,
};

// What the plan pushes on next, phrased for the goal. Shared so the progress
// screen and the end-of-session summary cannot drift apart.
function nextFocusForGoal(goal: string | undefined): string {
  if (goal === "strength") return "Progressive load";
  if (goal === "athletic") return "Power and speed";
  if (goal === "fat-loss") return "Training density";
  return "Movement quality";
}

// --- Training background ---------------------------------------------------
// The interview asks for experience across four levels, and all four have to
// mean something distinct: someone with three years under the bar should not
// be handed a first-timer's plan. Each constant below is deliberately modest,
// because the answer is a self-report, not a measurement -- double
// progression corrects an underestimate within a few sessions, whereas
// overestimating someone's starting point risks injury on session one.

// Multiplier on the suggested starting weight.
const EXPERIENCE_LOAD_FACTOR: Record<string, number> = {
  beginner: 0.75,
  novice: 0.9,
  intermediate: 1,
  advanced: 1.15,
};

// A moderate-rep floor for the less experienced. Low-rep, near-maximal work
// is a technique-and-injury risk for someone still learning the lifts,
// whatever their goal says -- so a "get stronger" beginner trains 8 solid
// reps light rather than 3 heavy ones, and the load factor above brings the
// weight down to match. Experienced trainees keep their goal's real range.
const EXPERIENCE_REP_FLOOR: Record<string, number> = {
  beginner: 8,
  novice: 6,
  intermediate: 0,
  advanced: 0,
};

// Sessions at the top of the rep range required before the load advances.
// Beginners genuinely do adapt fast (early gains are largely neural), so
// making them wait as long as an advanced lifter wastes the window where
// progress comes easiest. An advanced trainee is nearer their ceiling, so a
// longer confirmation avoids chasing a good day that won't repeat.
const EXPERIENCE_ADVANCE_SESSIONS: Record<string, number> = {
  beginner: 2,
  novice: 2,
  intermediate: 3,
  advanced: 4,
};

// Working sets added or removed. A beginner's limiting factor is recovery and
// technique under fatigue, not willingness; an advanced trainee needs more
// total volume before anything adapts at all.
const EXPERIENCE_SET_BONUS: Record<string, number> = {
  beginner: -1,
  novice: 0,
  intermediate: 0,
  advanced: 1,
};

// Age is a separate axis from experience -- a 50-year-old returning lifter is
// experienced AND needs a gentler entry point, so the two stack rather than
// one overriding the other (which is what the old single `reducedLoad`
// boolean did, treating "beginner" and "over 45" as the same thing).
// A third axis, and the reason it exists: experience asks what someone has
// done, not what they can do today. Three years under the bar followed by
// eight months off is experienced AND deconditioned -- they need a beginner's
// starting weight but keep an experienced lifter's ability to add to it.
//
// So this discount lands on LOAD only. advanceSessionsForProfile deliberately
// ignores it, which is what lets a returner climb back quickly instead of
// being restarted from scratch.
const RECENT_TRAINING_LOAD_FACTOR: Record<string, number> = {
  consistent: 1,
  patchy: 0.9,
  returning: 0.75,
};

function experienceLoadFactor(profile: Record<string, string>): number {
  const ageYears = Number(profile.age);
  const base = EXPERIENCE_LOAD_FACTOR[profile.experience ?? ""] ?? 1;
  const ageFactor = Number.isFinite(ageYears) && ageYears >= 45 ? 0.85 : 1;
  const recencyFactor = RECENT_TRAINING_LOAD_FACTOR[profile.recentTraining ?? ""] ?? 1;
  return base * ageFactor * recencyFactor;
}

function advanceSessionsForProfile(profile: Record<string, string>): number {
  return EXPERIENCE_ADVANCE_SESSIONS[profile.experience ?? ""] ?? 2;
}

// The starting target rep RANGE for an exercise with no logged history yet.
// The suggested number shown is always the low end (see ExerciseProgress) --
// conservative on purpose, since this is a first guess, not a measurement.
function baseRepRangeForProfile(profile: Record<string, string>): { low: number; high: number } {
  const ageYears = Number(profile.age);
  const target = GOAL_REP_TARGET[profile.goal ?? ""] ?? 10;
  const withFloor = Math.max(target, EXPERIENCE_REP_FLOOR[profile.experience ?? ""] ?? 0);
  const low = Number.isFinite(ageYears) && ageYears >= 45 ? Math.max(4, withFloor - 2) : withFloor;
  return { low, high: low + 4 };
}

// The goal's real rep range, with no experience-driven safety floor applied
// -- what an exercise should eventually settle into once someone has proven
// (not just claimed) they're ready. See the graduation step in
// commitExerciseProgress: a weighted exercise that started elevated by
// EXPERIENCE_REP_FLOOR gradually eases back down toward this as real
// advances accumulate, instead of staying parked at the beginner-safe range
// forever while only the weight keeps climbing.
function goalRepRange(profile: Record<string, string>): { low: number; high: number } {
  const target = GOAL_REP_TARGET[profile.goal ?? ""] ?? 10;
  return { low: target, high: target + 4 };
}

// How many successful weight advances (not sessions -- see
// EXPERIENCE_ADVANCE_SESSIONS for that) between each 1-rep graduation step.
// Same "slow but steady" reasoning as everything else here: the range should
// never jump down in one move, no matter how many advances have piled up.
const ADVANCES_PER_GRADUATION_STEP = 2;

// Seconds as m:ss.
//
// The rest timer used to render a hardcoded "0:" and pad the raw seconds, so
// any rest of a minute or more read as nonsense -- "0:75" for hypertrophy,
// "0:120" for strength. Only fat-loss and fitness were ever right, and only
// because their rest happens to be under a minute; the +15 button broke those
// too.
function clockLabel(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  return `${Math.floor(safe / 60)}:${String(safe % 60).padStart(2, "0")}`;
}

function restSecondsForProfile(profile: Record<string, string>, adjustment?: CoachScenario | null): number {
  const base = GOAL_REST_SECONDS[profile.goal ?? ""] ?? 60;
  return adjustment === "tired" ? base + 30 : base;
}

// --- Fitting the session to the time the user actually has -----------------
// The interview asks how long a workout can be, so the program has to respect
// the answer. A session is estimated rather than measured: sets of work, the
// rest between them, and the minute or so spent walking to the next station
// and setting up. Rest dominates on a strength plan (two minutes a set), which
// is why the same eight exercises can fit an hour and overrun half of one.
const SECONDS_PER_REP = 4.5;
const EXERCISE_TRANSITION_SECONDS = 60;
// Below this it stops being a session. If the stated budget can't hold four
// exercises, the budget loses -- better to run a few minutes over than to hand
// someone a token workout.
const MIN_EXERCISES_PER_SESSION = 4;

function exerciseSlotSeconds(workSecondsPerSet: number, setCount: number, restSeconds: number): number {
  // No rest is needed after the final set -- the transition covers it.
  return (
    setCount * workSecondsPerSet + Math.max(0, setCount - 1) * restSeconds + EXERCISE_TRANSITION_SECONDS
  );
}

function workSecondsForExercise(exercise: WorkoutExercise): number {
  const value = parseInt(exercise.reps, 10);
  if (!Number.isFinite(value)) return 10 * SECONDS_PER_REP;
  // A hold's reps field stores seconds, so it already is the work time.
  return isHoldExercise(exercise) ? value : value * SECONDS_PER_REP;
}

// "I only have 30 minutes today" from the coach overrides the standing answer,
// but only for that session.
function sessionBudgetMinutes(profile: Record<string, string>, adjustment?: CoachScenario | null): number {
  if (adjustment === "time") return 30;
  const stated = Number(profile.duration);
  return Number.isFinite(stated) && stated > 0 ? stated : 45;
}

// Trims from the end, which is where the split templates put accessory and
// core work -- so a short session loses the curl and the plank, not the squat.
function fitExercisesToDuration(
  exercises: WorkoutExercise[],
  setCount: number,
  restSeconds: number,
  budgetMinutes: number,
): WorkoutExercise[] {
  if (!Number.isFinite(budgetMinutes) || budgetMinutes <= 0) return exercises;
  const budgetSeconds = budgetMinutes * 60;
  const kept: WorkoutExercise[] = [];
  let usedSeconds = 0;
  for (const exercise of exercises) {
    const cost = exerciseSlotSeconds(workSecondsForExercise(exercise), setCount, restSeconds);
    if (usedSeconds + cost > budgetSeconds && kept.length >= MIN_EXERCISES_PER_SESSION) break;
    kept.push(exercise);
    usedSeconds += cost;
  }
  return kept;
}

// The same estimate from counts alone, for the dashboard card -- it advertises
// the session before the exercises have been fetched, and promising eight then
// delivering six would be worse than not saying a number at all.
function plannedExerciseCount(
  profile: Record<string, string>,
  slotCount: number,
  adjustment?: CoachScenario | null,
  isDeload?: boolean,
  checkIn?: DailyCheckIn | null,
): number {
  const perExercise = exerciseSlotSeconds(
    baseRepRangeForProfile(profile).low * SECONDS_PER_REP,
    setCountForProfile(profile, adjustment, isDeload, checkIn),
    restSecondsForProfile(profile, adjustment),
  );
  const fits = Math.floor((sessionBudgetMinutes(profile, adjustment) * 60) / perExercise);
  return Math.min(slotCount, Math.max(MIN_EXERCISES_PER_SESSION, fits));
}

// Collapses the four check-in answers into one 0-1 score. Fatigue and stress
// are asked as "how tired/stressed are you" (10 = worst), so they're inverted
// before averaging -- all four then point the same way, 1 = best possible day.
function checkInScore(checkIn: DailyCheckIn): number {
  const normalized = [checkIn.sleep, checkIn.nutrition, 11 - checkIn.fatigue, 11 - checkIn.stress].map(
    (value) => (Math.min(10, Math.max(1, value)) - 1) / 9,
  );
  return normalized.reduce((sum, value) => sum + value, 0) / normalized.length;
}

// Only a check-in from today counts. Yesterday's answers say nothing about
// how the user slept last night, and silently reusing them would be worse
// than having no signal at all.
function todaysCheckIn(checkIn: DailyCheckIn | null): DailyCheckIn | null {
  return checkIn && checkIn.date === todayDateKey() ? checkIn : null;
}

// How hard a bad day should pull the load down, per goal. Strength work is
// the most punishing to grind through under-recovered (heaviest loads, most
// technical lifts), so it backs off hardest. Fat-loss/fitness/health lean on
// consistency more than peak load, so their weight barely moves -- the volume
// cut below does the work for them instead.
const GOAL_READINESS_WEIGHT_SENSITIVITY: Record<string, number> = {
  strength: 0.18,
  // Explosive work under-recovered is both unproductive and the most likely
  // to hurt someone, so it backs off nearly as hard as strength does.
  athletic: 0.15,
  muscle: 0.12,
  "fat-loss": 0.07,
  fitness: 0.07,
  health: 0.08,
};

// Same idea for set count: goals that live on training volume (muscle) or on
// showing up at all (fat-loss/fitness/health) shed sets sooner on a rough
// day, while strength keeps its sets and gives up load instead.
const GOAL_READINESS_VOLUME_SENSITIVITY: Record<string, number> = {
  strength: 0.5,
  // Like strength, athletic training keeps its sets and gives up load: fewer
  // quality reps teaches less than the same reps done lighter and faster.
  athletic: 0.7,
  muscle: 1,
  "fat-loss": 1,
  fitness: 1,
  health: 1.5,
};

// A same-day readiness discount applied to suggested weight -- only ever
// reduces load, never adds to it, since normal double-progression already
// handles increases and an algorithm should never talk someone into more
// weight than usual on a day it has no real evidence they're ready for.
// (Deliberately still true with the check-in in place: a great check-in
// confirms the planned session rather than adding weight on top of it.)
// Signals: how recently they last trained, whether they told the coach
// they're tired, and -- when they filled it in today -- the check-in.
function readinessWeightModifier(
  workoutHistory: WorkoutHistoryEntry[],
  adjustment?: CoachScenario | null,
  checkIn?: DailyCheckIn | null,
  goal?: string,
): number {
  let modifier = 1;
  const hoursSince = hoursSinceLastWorkout(workoutHistory);
  if (hoursSince !== null && hoursSince < 20) modifier -= 0.06;
  if (adjustment === "tired") modifier -= 0.06;

  const today = todaysCheckIn(checkIn ?? null);
  if (today) {
    // Only the bottom half of the range discounts anything: a score at or
    // above 0.5 is "the planned session stands", not "add weight".
    const shortfall = Math.max(0, 0.5 - checkInScore(today)) * 2;
    const sensitivity = GOAL_READINESS_WEIGHT_SENSITIVITY[goal ?? ""] ?? 0.12;
    modifier -= shortfall * sensitivity;
  }

  return Math.max(0.7, modifier);
}

// Sets dropped from the session because of today's check-in, on the same
// bottom-half-only basis as the weight discount. Capped at 2 so a terrible
// day still leaves a real session rather than a token one.
function readinessSetPenalty(checkIn: DailyCheckIn | null, goal?: string): number {
  const today = todaysCheckIn(checkIn);
  if (!today) return 0;
  const shortfall = Math.max(0, 0.5 - checkInScore(today)) * 2;
  const sensitivity = GOAL_READINESS_VOLUME_SENSITIVITY[goal ?? ""] ?? 1;
  return Math.min(2, Math.round(shortfall * 2 * sensitivity));
}

// Isometric holds (plank and its variants) are timed, not counted -- "10
// reps" of a hold means nothing, so these get a starting hold length in
// seconds instead, and the UI shows "sec" wherever it would otherwise show
// "reps" for this exercise.
function holdSecondsForProfile(profile: Record<string, string>): number {
  return profile.experience === "beginner" ? 20 : profile.experience === "advanced" ? 40 : 30;
}

// Whether `reps` is a duration rather than a count.
//
// The name check alone was wrong for everything the local library added: a
// front rack carry, a wall sit, a hollow hold and a sprint interval are all
// timed, and none of them say "plank". They were prescribed in seconds and
// labelled REPS, which read as thirty repetitions of a wall sit.
function isHoldExercise(exercise: {
  name: string;
  isHold?: boolean;
  catalogMeta?: { movementPattern?: string };
}): boolean {
  return (
    exercise.isHold === true ||
    exercise.catalogMeta?.movementPattern === "isometric" ||
    exercise.name.includes("Plank")
  );
}

// Whether an exercise carries no external load.
//
// The rendered weight string is the honest source: the builder writes
// "Bodyweight" for unloaded work and a number for everything else, so anything
// that will not parse is unloaded whatever it is called. The name list stays as
// a second opinion for legacy roster entries.
function unloadedExerciseWeight(exercise: { name: string; weight: string }): boolean {
  return !Number.isFinite(parseFloat(exercise.weight)) || isBodyweightExerciseName(exercise.name);
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
    // "Dip" rather than "Bar Dip": the bench-dip regression is just as
    // unloaded, and matching the narrower name left it treated as a weighted
    // lift that would be handed a kilogram suggestion.
    name.includes("Dip") ||
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
  const loadFactor = experienceLoadFactor(profile);
  const reps = String(baseRepRangeForProfile(profile).low);
  const femaleExercises: WorkoutExercise[] = [
    {
      ...workoutExercises[0]!,
      name: "Dumbbell Front Squat",
      weight: "14 kg",
    },
    {
      ...workoutExercises[2]!,
      name: "Dumbbell Romanian Deadlift",
      target: "Glutes & hamstrings · Controlled",
      weight: "10 kg",
      phases: ["HINGE", "STRETCH", "DRIVE"],
      pose: exercisePoses.hinge,
    },
    {
      ...workoutExercises[1]!,
      name: "Dumbbell Shoulder Press",
      target: "Shoulders · Strength",
      weight: "6 kg",
      phases: ["LOWER", "BRACE", "PRESS"],
    },
    {
      ...workoutExercises[0]!,
      name: "Dumbbell Reverse Lunge",
      target: "Legs & glutes · Unilateral",
      weight: "6 kg",
      phases: ["STEP", "LOWER", "DRIVE"],
    },
    {
      ...workoutExercises[2]!,
      name: "Dumbbell Biceps Curl",
      target: "Arms · Controlled",
      weight: "5 kg",
      phases: ["LOWER", "CURL", "SQUEEZE"],
    },
    {
      ...workoutExercises[2]!,
      name: "Dumbbell Row",
      target: "Back · Controlled",
      weight: "8 kg",
      phases: ["REACH", "PULL", "RETURN"],
      pose: exercisePoses.bentRow,
    },
    {
      ...workoutExercises[2]!,
      name: "Glute Bridge",
      target: "Glutes · Isolation",
      phases: ["LOWER", "HOLD", "LIFT"],
      pose: exercisePoses.hinge,
    },
    {
      ...workoutExercises[1]!,
      name: "Plank",
      target: "Core · Isometric",
      tempo: "HOLD",
      phases: ["BRACE", "HOLD", "HOLD"],
    },
  ];
  const maleExercises: WorkoutExercise[] = [
    {
      ...workoutExercises[1]!,
      name: "Dumbbell Shoulder Press",
      target: "Shoulders · Strength",
      weight: "10 kg",
      phases: ["LOWER", "BRACE", "PRESS"],
      pose: exercisePoses.overheadPress,
    },
    {
      ...workoutExercises[2]!,
    },
    {
      ...workoutExercises[1]!,
      name: "Dumbbell Bench Press",
      target: "Chest · Strength",
      weight: "14 kg",
    },
    {
      ...workoutExercises[0]!,
      name: "Push-Up",
      target: "Chest & triceps · Bodyweight",
      phases: ["LOWER", "HOLD", "PRESS"],
    },
    {
      ...workoutExercises[1]!,
      name: "Dumbbell Biceps Curl",
      target: "Arms · Controlled",
      weight: "8 kg",
      phases: ["LOWER", "CURL", "SQUEEZE"],
    },
    {
      ...workoutExercises[0]!,
      name: "Dumbbell Lunge",
      target: "Legs & glutes · Unilateral",
      weight: "10 kg",
      phases: ["STEP", "LOWER", "DRIVE"],
    },
    {
      ...workoutExercises[0]!,
      name: "Calf Raise",
      target: "Calves · Isolation",
      weight: "14 kg",
      phases: ["LOWER", "HOLD", "RAISE"],
    },
    {
      ...workoutExercises[1]!,
      name: "Plank",
      target: "Core · Isometric",
      tempo: "HOLD",
      phases: ["BRACE", "HOLD", "HOLD"],
    },
  ];
  const femaleBodyweightExercises: WorkoutExercise[] = [
    {
      ...workoutExercises[0]!,
      name: "Bodyweight Squat",
      target: "Lower body · Bodyweight",
      phases: ["LOWER", "HOLD", "DRIVE"],
    },
    {
      ...workoutExercises[0]!,
      name: "Push-Up",
      target: "Chest & triceps · Bodyweight",
      phases: ["LOWER", "HOLD", "PRESS"],
    },
    {
      ...workoutExercises[0]!,
      name: "Bodyweight Reverse Lunge",
      target: "Legs & glutes · Unilateral",
      phases: ["STEP", "LOWER", "DRIVE"],
    },
    {
      ...workoutExercises[2]!,
      name: "Glute Bridge",
      target: "Glutes · Isolation",
      phases: ["LOWER", "HOLD", "LIFT"],
      pose: exercisePoses.hinge,
    },
    {
      ...workoutExercises[1]!,
      name: "Plank",
      target: "Core · Isometric",
      tempo: "HOLD",
      phases: ["BRACE", "HOLD", "HOLD"],
    },
    {
      ...workoutExercises[1]!,
      name: "Mountain Climbers",
      target: "Core & cardio · Bodyweight",
      tempo: "FAST",
      phases: ["BRACE", "DRIVE", "SWITCH"],
    },
  ];
  const maleBodyweightExercises: WorkoutExercise[] = [
    {
      ...workoutExercises[0]!,
      name: "Bodyweight Squat",
      target: "Lower body · Bodyweight",
      phases: ["LOWER", "HOLD", "DRIVE"],
    },
    {
      ...workoutExercises[0]!,
      name: "Push-Up",
      target: "Chest & triceps · Bodyweight",
      phases: ["LOWER", "HOLD", "PRESS"],
    },
    {
      ...workoutExercises[0]!,
      name: "Bodyweight Reverse Lunge",
      target: "Legs & glutes · Unilateral",
      phases: ["STEP", "LOWER", "DRIVE"],
    },
    {
      ...workoutExercises[1]!,
      name: "Burpee",
      target: "Full body · Cardio",
      tempo: "FAST",
      phases: ["SQUAT", "PLANK", "JUMP"],
    },
    {
      ...workoutExercises[1]!,
      name: "Plank",
      target: "Core · Isometric",
      tempo: "HOLD",
      phases: ["BRACE", "HOLD", "HOLD"],
    },
    {
      ...workoutExercises[1]!,
      name: "High Knees",
      target: "Core & cardio · Bodyweight",
      tempo: "FAST",
      phases: ["DRIVE", "SWITCH", "DRIVE"],
    },
    {
      // Belongs in a bodyweight programme on its own merit -- it was only ever
      // in the gym roster. It also happens to be one of the few movements here
      // that survives an abdominal limitation, which matters while the
      // catalog is unavailable and this roster is the entire pool.
      // Named apart from the gym roster's loaded "Calf Raise" on purpose:
      // isBodyweightExerciseName keys off the name, so the same label can't
      // mean loaded in one roster and unloaded in another.
      ...workoutExercises[0]!,
      name: "Bodyweight Calf Raise",
      target: "Calves · Bodyweight",
      phases: ["LOWER", "HOLD", "RAISE"],
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
      phases: ["BRACE", "LOWER", "PRESS"],
    },
    {
      ...workoutExercises[1]!,
      name: "Knee Raise",
      target: "Core · Bodyweight",
      phases: ["BRACE", "RAISE", "LOWER"],
    },
  ];
  const maleBarsExercises: WorkoutExercise[] = [
    {
      ...workoutExercises[0]!,
      name: "Pull-Up",
      target: "Back & biceps · Bodyweight",
      phases: ["HANG", "PULL", "LOWER"],
    },
    {
      ...workoutExercises[1]!,
      name: "Bar Dip",
      target: "Chest & triceps · Bodyweight",
      phases: ["BRACE", "LOWER", "PRESS"],
    },
    {
      ...workoutExercises[1]!,
      name: "Hanging Leg Raise",
      target: "Core · Bodyweight",
      phases: ["HANG", "RAISE", "LOWER"],
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
    const isHold = exercise.name.includes("Plank");
    const implement = implementForExerciseName(exercise.name);
    const savedProgress = exerciseProgress[exercise.name]
      ? normalizeExerciseProgress(exerciseProgress[exercise.name]!, baseRepRangeForProfile(profile))
      : null;
    return {
      ...exercise,
      implement: isBodyweight ? undefined : implement,
      weightPerHand: !isBodyweight && isPerHandLoad(exercise.name, implement),
      repsPerSide: isHold ? undefined : (perSideUnitLabel(exercise.name) ?? undefined),
      reps: savedProgress
        ? String(savedProgress.repsLow)
        : isHold
          ? String(holdSecondsForProfile(profile))
          : reps,
      repsHigh: isHold
        ? undefined
        : String(savedProgress ? savedProgress.repsHigh : baseRepRangeForProfile(profile).high),
      tempo: Number.isFinite(ageYears) && ageYears >= 55 ? "3–1–2" : exercise.tempo,
      weight: isBodyweight
        ? "Bodyweight"
        : savedProgress && hasEarnedWeight(savedProgress)
          ? // Snap saved progress too: records written before weights were
            // constrained to real gym increments can hold unloadable numbers.
            `${snapToLoadableWeight(savedProgress.weightKg, implement)} kg`
          : scaledStartingWeightLabel(parseFloat(exercise.weight) * loadFactor, bodyWeightKg, implement),
    };
  });

  const limitations = splitAnswerValues(profile.limitations);
  if (limitations.includes("knee")) {
    const squatIndex = exercises.findIndex((exercise) => exercise.name.includes("Squat"));
    if (squatIndex >= 0) {
      exercises[squatIndex] = {
        ...exercises[squatIndex]!,
        name: "Box Goblet Squat",
        target: "Lower body · Knee-aware",
        // A goblet hold is one bell in both hands, unlike the two-dumbbell
        // squat this replaces -- so the load stops being a per-hand number.
        weightPerHand: false,
      };
    }
  }
  // Regressions for movements the user has told us they can't do yet.
  //
  // Prescribing 8-12 pull-ups to someone who cannot do one isn't a hard
  // session, it's a wall -- they fail the first set and have no way to
  // progress. The regressions keep the same pattern at a load they can
  // actually complete, so double progression has something to work with.
  //
  // These rename and keep the existing demo media, the same trade the
  // knee/shoulder swaps above make: a roster entry can't gain its own video
  // without one being shot for it, and a named regression with an approximate
  // demo beats an exercise the person cannot perform.
  const canPullUp = profile.bodyweightStrength === "both";
  const canPushUp = profile.bodyweightStrength !== "neither";
  if (!canPullUp) {
    for (const [index, exercise] of exercises.entries()) {
      if (exercise.name === "Pull-Up") {
        exercises[index] = { ...exercise, name: "Band-Assisted Pull-Up", target: "Back & biceps · Building up" };
      } else if (exercise.name === "Bar Dip") {
        exercises[index] = { ...exercise, name: "Bench Dip", target: "Chest & triceps · Building up" };
      }
    }
  }
  if (!canPushUp) {
    const pushUpIndex = exercises.findIndex((exercise) => exercise.name === "Push-Up");
    if (pushUpIndex >= 0) {
      exercises[pushUpIndex] = {
        ...exercises[pushUpIndex]!,
        name: "Knee Push-Up",
        target: "Chest & triceps · Building up",
      };
    }
  }

  if (limitations.includes("back")) {
    // The catalog path filtered on back safety from the start, but this
    // fallback roster did nothing at all -- so someone reporting back
    // sensitivity was still handed a Romanian deadlift, the exact loaded hip
    // hinge they should be avoiding. Swap it for a supported hinge that keeps
    // the spine neutral and the load off the lumbar chain.
    const hingeIndex = exercises.findIndex(
      (exercise) => exercise.name.includes("Deadlift") || exercise.name.includes("Hinge"),
    );
    if (hingeIndex >= 0) {
      exercises[hingeIndex] = {
        ...exercises[hingeIndex]!,
        name: "Glute Bridge",
        target: "Glutes & hamstrings · Back-aware",
        weight: "Bodyweight",
        weightPerHand: false,
        implement: undefined,
        phases: ["LOWER", "HOLD", "LIFT"],
        pose: exercisePoses.hinge,
      };
    }
  }
  if (limitations.includes("shoulder")) {
    const pressIndex = exercises.findIndex((exercise) => exercise.name.includes("Press"));
    if (pressIndex >= 0) {
      exercises[pressIndex] = {
        ...exercises[pressIndex]!,
        name: "Neutral-Grip Dumbbell Press",
        target: "Upper body · Shoulder-aware",
        phases: ["LOWER", "PAUSE", "PRESS"],
        pose: exercisePoses.bench,
      };
    }
  }

  return exercises;
}

// Conservative starting anchors for catalog exercises, expressed as what one
// DUMBBELL would hold for an average untrained adult -- a shoulder press and a
// biceps curl are not the same load, and neither is a row and a squat, so a
// single number for the whole catalog (which is what this used to be) is
// always wrong for almost every exercise. These are deliberately light
// starting points, not strength predictions: the double-progression system is
// what finds each person's real working weight from here.
const CATALOG_BASE_DUMBBELL_KG: Record<PrimaryMuscle, number> = {
  chest: 12,
  back: 14,
  shoulders: 8,
  biceps: 8,
  triceps: 7,
  quads: 14,
  hamstrings: 12,
  glutes: 12,
  calves: 14,
  core: 5,
  "full-body": 10,
};

// A dumbbell number is per hand; a barbell or a machine stack moves the whole
// body of work at once, so the same effort reads as a much bigger number.
const IMPLEMENT_LOAD_FACTOR: Record<LoadableImplement, number> = {
  dumbbell: 1,
  kettlebell: 1,
  barbell: 1.8,
  machine: 1.8,
  other: 1,
};

// Bodyweight scaling alone understates the gap in upper-body starting loads,
// so the catalog path (which has no per-sex exercise roster to draw from,
// unlike createWorkout) applies a modest explicit factor as well.
const CATALOG_SEX_LOAD_FACTOR: Record<string, number> = { male: 1, female: 0.7 };

// Which movement demos a CATALOG exercise. Catalog names are free-form
// (MuscleWiki's), so this is tiered: an exact library-name match first, then
// name keywords from most to least specific, then a movement-pattern family
// only where the family demo cannot mislead -- and a written cue (undefined)
// over a wrong animation everywhere else. Born of a production bug: this
// path hardcoded the back squat for every exercise, and no local review ever
// saw it because the catalog API only runs in production.
function poseForCatalogExercise(tag: ExerciseTag): PoseName | undefined {
  const mapped = POSE_FOR_EXERCISE[tag.name];
  if (mapped) return mapped;
  const n = tag.name.toLowerCase();
  const bodyweight = tag.equipment.toLowerCase() === "bodyweight";
  if (/pistol/.test(n)) return "pistolSquat";
  if (/goblet/.test(n)) return "gobletSquat";
  if (/front squat/.test(n)) return "frontSquat";
  if (/split squat|bulgarian/.test(n)) return "splitSquat";
  if (/wall sit/.test(n)) return "wallSit";
  if (/jump squat|squat jump/.test(n)) return "jump";
  if (/\bsquat\b/.test(n)) return bodyweight ? "bodyweightSquat" : "squat";
  if (/good morning/.test(n)) return "goodMorning";
  if (/single[- ]leg.*(deadlift|rdl)|one[- ]leg.*deadlift/.test(n)) return "singleLegHinge";
  if (/deadlift|\brdl\b|romanian|rack pull/.test(n)) return "hinge";
  if (/hip thrust|glute bridge/.test(n)) return "hipThrust";
  if (/swing/.test(n)) return "hinge";
  if (/clean|snatch/.test(n)) return "clean";
  if (/curtsy/.test(n)) return "curtsyLunge";
  if (/lateral lunge|side lunge|cossack/.test(n)) return "lateralLunge";
  if (/lunge|step[- ]?up/.test(n)) return "lunge";
  if (/leg press/.test(n)) return "legPress";
  if (/leg extension/.test(n)) return "legExtension";
  if (/leg curl/.test(n)) return "legCurl";
  if (/calf/.test(n)) return /seated/.test(n) ? "seatedCalfRaise" : "calfRaise";
  if (/pike/.test(n)) return "pikePushUp";
  if (/handstand/.test(n)) return "handstandPushUp";
  if (/knee push/.test(n)) return "kneePushUp";
  if (/push[- ]?up|pushup/.test(n)) return "pushUp";
  if (/tate press/.test(n)) return "skullCrusher";
  if (/spoto press|squeeze press/.test(n)) return "bench";
  if (/pallof/.test(n)) return "facePull";
  if (/knee tuck/.test(n)) return "mountainClimber";
  if (/incline.*(press|bench)/.test(n)) return "inclinePress";
  if (/bench|chest press|floor press/.test(n)) return "bench";
  if (/landmine/.test(n)) return "landminePress";
  if (/overhead press|shoulder press|military|push press|arnold|z press/.test(n)) return "overheadPress";
  if (/lateral raise|side raise/.test(n)) return "lateralRaise";
  if (/front raise/.test(n)) return "frontRaise";
  if (/reverse fly|rear delt/.test(n)) return "reverseFly";
  if (/\bfly\b|flye|pec deck/.test(n)) return "fly";
  if (/face pull/.test(n)) return "facePull";
  if (/straight[- ]arm pulldown|pullover/.test(n)) return "straightArmPulldown";
  if (/pulldown|lat pull/.test(n)) return "pulldown";
  if (/pull[- ]?up|chin[- ]?up|pullup|chinup/.test(n)) return "pullUp";
  if (/one[- ]?arm.*row|single[- ]arm.*row/.test(n)) return "oneArmRow";
  if (/inverted row/.test(n)) return "invertedRow";
  if (/seated.*row|cable row/.test(n)) return "seatedRow";
  if (/\brow\b/.test(n)) return "bentRow";
  if (/skull ?crusher|lying triceps/.test(n)) return "skullCrusher";
  if (/kickback/.test(n)) return "kickback";
  if (/pushdown|triceps extension|overhead extension/.test(n)) return "tricepsExtension";
  if (/ring.*curl|suspension.*curl|trx.*curl/.test(n)) return "ringCurl";
  if (/incline.*curl/.test(n)) return "inclineCurl";
  if (/\bcurl\b/.test(n)) return "curl";
  if (/\bdips?\b/.test(n)) return "dip";
  if (/side plank/.test(n)) return "sidePlank";
  if (/iytw/.test(n)) return "plankIYTW";
  if (/plank saw|body saw/.test(n)) return "plankSaw";
  if (/plank/.test(n)) return "plank";
  if (/mountain climber/.test(n)) return "mountainClimber";
  if (/burpee/.test(n)) return "burpee";
  if (/bicycle/.test(n)) return "bicycleCrunch";
  if (/cable crunch/.test(n)) return "cableCrunch";
  if (/russian twist/.test(n)) return "russianTwist";
  if (/woodchop|wood chop|chop|twist/.test(n)) return "woodchop";
  if (/ab wheel|rollout/.test(n)) return "abWheelRollout";
  if (/hanging.*raise|knee raise|leg raise|toes to bar/.test(n)) return "hangingRaise";
  if (/hollow|crunch|sit[- ]?up|v[- ]?up|dead ?bug/.test(n)) return "hollowHold";
  if (/superman|back extension|hyperextension/.test(n)) return "proneRaise";
  if (/carry|farmer|suitcase/.test(n)) return "carry";
  if (/jump|bound|hop/.test(n)) return "jump";
  if (/sprint|running|high knees|jog/.test(n)) return "run";
  if (/sled/.test(n)) return "sledPush";
  if (/battle rope/.test(n)) return "battleRopes";
  // Family fallback, only where the family cannot teach the wrong technique.
  switch (tag.movementPattern) {
    case "squat": return bodyweight ? "bodyweightSquat" : "squat";
    case "hinge": return "hinge";
    case "lunge": return "lunge";
    case "carry": return "carry";
    case "isometric": return "plank";
    default: return undefined;
  }
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
  const isHold = tag.movementPattern === "isometric";
  const implement = implementForCatalogExercise(tag.equipment, tag.name);
  const range = baseRepRangeForProfile(profile);
  const savedProgress = exerciseProgress[tag.name]
    ? normalizeExerciseProgress(exerciseProgress[tag.name]!, range)
    : null;
  const reps = savedProgress
    ? String(savedProgress.repsLow)
    : String(isHold ? holdSecondsForProfile(profile) : range.low);
  // Deload week backs off the weight on its own (lighter session, not a rest
  // day) -- the readiness modifier is for everything else (poor recovery,
  // self-reported "tired"), so the two never stack; deload wins when both apply.
  const savedWeightKg =
    savedProgress && hasEarnedWeight(savedProgress)
      ? snapToLoadableWeight(savedProgress.weightKg * (isDeload ? 0.85 : weightModifier), implement)
      : null;
  const weight = isBodyweight
    ? "Bodyweight"
    : savedWeightKg !== null
      ? `${savedWeightKg} kg`
      : scaledStartingWeightLabel(
          CATALOG_BASE_DUMBBELL_KG[tag.primaryMuscle] *
            IMPLEMENT_LOAD_FACTOR[implement] *
            (CATALOG_SEX_LOAD_FACTOR[profile.sex ?? ""] ?? 0.85) *
            experienceLoadFactor(profile) *
            (isDeload ? 0.85 : weightModifier),
          bodyWeightKg,
          implement,
        );

  return {
    name: tag.name,
    target: `${tag.primaryMuscle.replace("-", " ")} · ${tag.movementPattern}`,
    weight,
    reps,
    repsHigh: isHold ? undefined : String(savedProgress ? savedProgress.repsHigh : range.high),
    implement: isBodyweight ? undefined : implement,
    weightPerHand: !isBodyweight && isPerHandLoad(tag.name, implement),
    repsPerSide:
      isHold || !tag.unilateral
        ? undefined
        : (perSideUnitLabel(tag.name, tag.primaryMuscle) ?? undefined),
    tempo: isHold ? "HOLD" : "3-1-1",
    phases: isHold ? ["BRACE", "HOLD", "HOLD"] : ["LOWER", "BRACE", "LIFT"],
    pose: (() => { const p = poseForCatalogExercise(tag); return p ? exercisePoses[p] : undefined; })(),
    demoImplement: isBodyweight ? undefined : implement,
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
  checkIn?: DailyCheckIn | null,
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
  const limitationsMap: Record<string, ProgramBuilderProfile["limitations"][number]> = {
    knee: "knee",
    shoulder: "shoulder",
    back: "back",
    none: "none",
    other: "other",
  };

  const builderProfile: ProgramBuilderProfile = {
    equipment: equipmentMap[profile.equipment ?? ""] ?? "minimal",
    experience: (profile.experience as ProgramBuilderProfile["experience"]) ?? "beginner",
    limitations: splitAnswerValues(profile.limitations)
      .map((entry) => limitationsMap[entry])
      .filter((entry): entry is ProgramBuilderProfile["limitations"][number] => Boolean(entry)),
    bodyweightStrength:
      profile.bodyweightStrength === "both" ||
      profile.bodyweightStrength === "pushups" ||
      profile.bodyweightStrength === "neither"
        ? profile.bodyweightStrength
        : undefined,
    sex: profile.sex === "male" ? "male" : "female",
  };

  const reminderDays = profile.reminderDays ? profile.reminderDays.split(",") : [];
  const { day: splitDay, label: splitLabel } = determineSplitDay(reminderDays, recentSplitDaysFromHistory(workoutHistory));
  const { isDeload } = getMesocycleWeek(workoutHistory);
  const weightModifier = isDeload
    ? 1
    : readinessWeightModifier(workoutHistory, coachAdjustment, checkIn, profile.goal);
  // Rotation is driven by how many of this split day are already logged, so the
  // same history always rebuilds the same session. Randomness here would
  // reshuffle the exercises under a user mid-workout on any re-render.
  const sessionIndex = workoutHistory.filter((entry) => entry.splitDay === splitDay).length;
  const blockIndex = mesocycleBlockIndex(workoutHistory);

  try {
    const tags = await buildProgram(builderProfile, splitDay);
    // Split templates range from 4 (push/pull) to 8 (full-body) slots -- judge
    // "did this work" against a floor, not a fixed count meant for full-body.
    if (tags.length < 4) {
      console.error(
        `Catalog program only filled ${tags.length} slots for "${splitDay}" -- building from the local library instead`,
      );
      return libraryWorkout(profile, splitDay, splitLabel, exerciseProgress, isDeload, weightModifier, sessionIndex, blockIndex);
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
    console.error("Catalog workout build failed -- building from the local library instead", error);
    return libraryWorkout(profile, splitDay, splitLabel, exerciseProgress, isDeload, weightModifier, sessionIndex, blockIndex);
  }
}

// One decision per exercise, per limitation note -- kept, not re-asked.
//
// Asking the model fresh every session made session length unpredictable: the
// same note could yield two removals one day and six the next, purely from
// sampling. Judgements are now cached per exercise name and only unseen
// exercises are ever sent, so a given note decides each exercise exactly once
// and later sessions of a different split fill in the gaps rather than
// re-litigating what was already settled.
type LimitationVerdicts = {
  // The note these judgements answer. A different note voids all of them.
  note: string;
  // Exercise name -> true when it should be removed.
  verdicts: Record<string, boolean>;
};

// Applies the free-text limitation from onboarding to an already-built
// session, by asking the veto endpoint which exercises to drop.
//
// Everything about the session -- selection, weights, reps, sets, order --
// was decided deterministically before this runs. This can only subtract.
// The result is re-validated here as well as server-side, because a client
// should never drop an exercise on the strength of a name it didn't recognise.
async function applyLimitationVeto(
  exercises: WorkoutExercise[],
  profile: Record<string, string>,
  cached: LimitationVerdicts,
  onVerdictsChange: (next: LimitationVerdicts) => void,
): Promise<WorkoutExercise[]> {
  const note = (profile.limitationsNote ?? "").trim();
  if (!splitAnswerValues(profile.limitations).includes("other") || note.length === 0 || exercises.length === 0) {
    // Clear stale verdicts once the limitation is gone, so re-selecting
    // "other" later starts from a clean judgement rather than an old one.
    if (cached.note.length > 0) onVerdictsChange({ note: "", verdicts: {} });
    return exercises;
  }

  // A changed note voids every previous judgement -- they were answers to a
  // different question.
  const verdicts = cached.note === note ? cached.verdicts : {};
  const unjudged = exercises.filter((exercise) => !(exercise.name in verdicts));

  let resolved = verdicts;
  if (unjudged.length > 0) {
    try {
      const response = await fetch("/api/exercise-veto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exercises: unjudged.map((exercise) => exercise.name),
          limitationNote: note,
          // The endpoint discards a veto that covers the whole session as a
          // malfunction. It needs the real session size to judge that, since
          // what's being sent here is only the not-yet-judged part.
          sessionSize: exercises.length,
        }),
      });
      if (response.ok) {
        const data = (await response.json()) as { remove?: unknown };
        const remove = new Set(
          (Array.isArray(data.remove) ? data.remove : []).filter(
            (name): name is string => typeof name === "string",
          ),
        );
        resolved = { ...verdicts };
        for (const exercise of unjudged) resolved[exercise.name] = remove.has(exercise.name);
        onVerdictsChange({ note, verdicts: resolved });
      }
    } catch (error) {
      // Fall through on the verdicts already held. Anything unjudged is kept,
      // which is the same session the user would have had regardless.
      console.error("Limitation veto failed -- using the verdicts already held", error);
    }
  }

  const kept = exercises.filter((exercise) => resolved[exercise.name] !== true);
  // Deliberately no minimum here, unlike the duration trim. That floor exists
  // because a short session is worse than a long one; this one would mean
  // putting an exercise back that was removed for safety. A shorter session is
  // the correct outcome. Only an empty one is rejected.
  return kept.length > 0 ? kept : exercises;
}

// What the veto took out, for the workout screen to explain. Removing
// exercises silently leaves someone staring at a two-exercise session with no
// idea why, and no way to tell it apart from a bug.
// Runs the limitation veto and then puts back what it took.
//
// The veto only ever shortened a session. A free-text hernia removed five of
// eight and the user was handed a three-exercise workout -- every time, with
// nothing filling the gaps. Refills come from the library, excluding both what
// survived and what the veto already rejected, and only the new movements are
// judged: verdicts are cached per name, so nothing is asked about twice.
//
// Two passes at most. A note strict enough to reject two sessions' worth of
// movements has earned the short session and the prompt to talk to a coach.
async function vetAndRefill(
  built: WorkoutExercise[],
  profile: Record<string, string>,
  result: { splitDay?: SplitDay; isDeload?: boolean; weightModifier?: number } | null,
  exerciseProgress: Record<string, ExerciseProgress>,
  workoutHistory: WorkoutHistoryEntry[],
  cachedVerdicts: LimitationVerdicts,
  onVerdictsChange: (next: LimitationVerdicts) => void,
): Promise<{ exercises: WorkoutExercise[]; rejectedCount: number }> {
  let verdicts = cachedVerdicts;
  const remember = (next: LimitationVerdicts) => {
    verdicts = next;
    onVerdictsChange(next);
  };

  let kept = await applyLimitationVeto(built, profile, verdicts, remember);
  const rejected = new Set(built.filter((item) => !kept.includes(item)).map((item) => item.name));
  // Only what the user would otherwise have been given counts as removed.
  // Replacements the veto also rejected are the search working, not something
  // taken away -- counting those said "13 exercises removed" on a session of 8.
  const removedFromPlan = rejected.size;

  const splitDay = result?.splitDay;
  if (splitDay && kept.length < built.length) {
    const sessionIndex = workoutHistory.filter((entry) => entry.splitDay === splitDay).length;
    const blockIndex = mesocycleBlockIndex(workoutHistory);
    for (let attempt = 0; attempt < 2 && kept.length < built.length; attempt++) {
      const taken = new Set([...kept.map((item) => item.name), ...rejected]);
      const replacements = buildProgramFromLibrary(
        profile,
        splitDay,
        exerciseProgress,
        result?.isDeload ?? false,
        result?.weightModifier ?? 1,
        sessionIndex,
        blockIndex,
        taken,
      ).filter((item) => !taken.has(item.name));
      if (replacements.length === 0) break;
      const safe = await applyLimitationVeto(replacements, profile, verdicts, remember);
      for (const item of replacements) if (!safe.includes(item)) rejected.add(item.name);
      if (safe.length === 0) continue;
      kept = [...kept, ...safe].slice(0, built.length);
    }
  }

  // Not how much shorter the session got -- with refilling it usually is not
  // shorter at all, and "0 removed" would hide that five movements were swapped.
  return { exercises: kept, rejectedCount: removedFromPlan };
}

// Shown in place of a demo when an exercise has no footage yet.
//
// Deliberately not a stand-in photograph: borrowing another movement's image
// would be worse than showing none, because a trainee copying what they see
// would do the wrong exercise. Words they can follow beat a picture that lies.
// Which library movements the five authored poses genuinely depict.
//
// Listed by name rather than matched by pattern, because a pattern over-reaches
// and a figure showing the wrong movement is worse than no figure: a Cossack
// squat is lateral, a single-leg RDL stands on one leg, a chest-supported row
// lies on a bench. Each of those would have been swept up by a regex on
// "squat", "deadlift" and "row".
//
// Everything absent from this list keeps its written cue until a pose is
// authored for it.
// Which library movements each authored pose genuinely depicts.
//
// Listed by name rather than matched by pattern, because a pattern over-reaches
// and a figure showing the wrong movement is worse than no figure: a regex on
// "squat", "deadlift" and "row" would sweep up the Cossack squat (lateral), the
// single-leg RDL (one leg in the air) and the chest-supported row (lying on a
// bench), none of which look like the pose.
//
// Absent from this list means the written cue, until a pose is authored for it.
const POSE_FOR_EXERCISE: Record<string, PoseName> = {
  "Pistol Squat": "pistolSquat",
  "Leg Press": "legPress",
  "Landmine Press": "landminePress",
  "Pike Push-Up": "pikePushUp",
  "Handstand Push-Up": "handstandPushUp",
  "Straight-Arm Pulldown": "straightArmPulldown",
  "Face Pull": "facePull",
  "Dumbbell Reverse Fly": "reverseFly",
  "Curtsy Lunge": "curtsyLunge",
  "Seated Calf Raise": "seatedCalfRaise",
  "Ab Wheel Rollout": "abWheelRollout",
  "Cable Crunch": "cableCrunch",
  "Russian Twist": "russianTwist",
  "Bicycle Crunch": "bicycleCrunch",
  "Burpee": "burpee",
  "Battle Ropes": "battleRopes",
  "Sled Push": "sledPush",
  "Barbell Back Squat": "squat",
  "Barbell Front Squat": "frontSquat",
  "Goblet Squat": "gobletSquat",
  "Heels-Elevated Goblet Squat": "gobletSquat",
  "Dumbbell Front Squat": "gobletSquat",
  "Box Squat": "squat",
  "Bodyweight Squat": "bodyweightSquat",
  "Hack Squat": "squat",
  "Smith Machine Squat": "squat",

  "Conventional Deadlift": "hinge",
  "Sumo Deadlift": "hinge",
  "Trap Bar Deadlift": "hinge",
  "Romanian Deadlift": "hinge",
  "Dumbbell Romanian Deadlift": "hinge",
  "Stiff-Leg Deadlift": "hinge",
  "Rack Pull": "hinge",
  "Good Morning": "goodMorning",
  "Bodyweight Good Morning": "goodMorning",
  "Kettlebell Swing": "hinge",

  "Barbell Bench Press": "bench",
  "Dumbbell Bench Press": "bench",
  "Dumbbell Floor Press": "bench",
  "Machine Chest Press": "bench",
  "Close-Grip Bench Press": "bench",

  "Barbell Overhead Press": "overheadPress",
  "Push Press": "overheadPress",
  "Dumbbell Shoulder Press": "overheadPress",
  "Seated Dumbbell Press": "overheadPress",
  "Arnold Press": "overheadPress",
  "Machine Shoulder Press": "overheadPress",

  "Barbell Row": "bentRow",
  "Pendlay Row": "bentRow",
  "One-Arm Dumbbell Row": "oneArmRow",
  "T-Bar Row": "bentRow",

  "Bodyweight Reverse Lunge": "lunge",
  "Walking Lunge": "lunge",
  "Dumbbell Lunge": "lunge",
  "Barbell Walking Lunge": "lunge",
  "Split Squat": "lunge",

  "Push-Up": "pushUp",
  "Diamond Push-Up": "pushUp",

  "Pull-Up": "pullUp",
  "Chin-Up": "pullUp",
  "Negative Pull-Up": "pullUp",

  "Barbell Curl": "curl",
  "Dumbbell Biceps Curl": "curl",
  "Hammer Curl": "curl",
  "Cable Curl": "curl",
  "Band Curl": "curl",

  "Triceps Pushdown": "tricepsExtension",
  "Overhead Triceps Extension": "tricepsExtension",

  "Dumbbell Lateral Raise": "lateralRaise",
  "Cable Lateral Raise": "lateralRaise",

  "Bodyweight Calf Raise": "calfRaise",
  "Dumbbell Calf Raise": "calfRaise",

  "Plank": "plank",

  "Farmer's Carry": "carry",
  "Incline Barbell Bench Press": "inclinePress",
  "Incline Dumbbell Press": "inclinePress",
  "Neutral-Grip Dumbbell Press": "bench",
  "Band Chest Press": "bench",
  "Knee Push-Up": "kneePushUp",
  "Incline Push-Up": "pushUp",
  "Decline Push-Up": "pushUp",
  "Archer Push-Up": "pushUp",
  "Plyo Push-Up": "pushUp",
  "Dumbbell Fly": "fly",
  "Cable Chest Fly": "fly",
  "Pec Deck": "fly",
  "Bar Dip": "dip",
  "Bench Dip": "dip",
  "Skull Crusher": "skullCrusher",
  "Band Overhead Press": "overheadPress",
  "Push Jerk": "overheadPress",

  "Lat Pulldown": "pulldown",
  "Neutral-Grip Pulldown": "pulldown",
  "Band-Assisted Pull-Up": "pullUp",
  "Seated Cable Row": "seatedRow",
  "Chest-Supported Row": "seatedRow",
  "Band Row": "seatedRow",
  "Inverted Row": "invertedRow",
  "Towel Row": "invertedRow",
  "Doorway Row": "invertedRow",
  "Hanging Leg Raise": "hangingRaise",
  "Hanging Knee Raise": "hangingRaise",
  "Superman": "proneRaise",
  "Prone Y-T-W Raise": "proneRaise",
  "Reverse Snow Angel": "proneRaise",
  "Incline Dumbbell Curl": "inclineCurl",
  "Preacher Curl": "curl",
  "Concentration Curl": "curl",

  "Cable Pull-Through": "hinge",
  "Back Extension": "hinge",
  "Hip Hinge Wall Touch": "hinge",
  "Single-Leg Romanian Deadlift": "singleLegHinge",
  "Single-Leg Deadlift": "singleLegHinge",
  "Barbell Hip Thrust": "hipThrust",
  "Glute Bridge": "hipThrust",
  "Single-Leg Glute Bridge": "hipThrust",
  "Frog Pump": "hipThrust",
  "Lying Leg Curl": "legCurl",
  "Seated Leg Curl": "legCurl",
  "Nordic Hamstring Curl": "legCurl",

  "Bulgarian Split Squat": "splitSquat",
  "Dumbbell Bulgarian Split Squat": "splitSquat",
  "Step-Up": "splitSquat",
  "Dumbbell Step-Up": "splitSquat",
  "Lateral Lunge": "lateralLunge",
  "Cossack Squat": "lateralLunge",
  "Wall Sit": "wallSit",
  "Single-Leg Calf Raise": "calfRaise",

  "Box Jump": "jump",
  "Broad Jump": "jump",
  "Jump Squat": "jump",
  "Tuck Jump": "jump",
  "Depth Jump": "jump",
  "Jumping Lunge": "jump",
  "Skater Bound": "jump",
  "Sprint Intervals": "run",
  "High Knees": "run",

  "Hollow Hold": "hollowHold",
  "Dead Bug": "hollowHold",
  "V-Up": "hollowHold",
  "Side Plank": "sidePlank",
  "Copenhagen Plank": "sidePlank",
  "Cable Woodchopper": "woodchop",
  "Medicine Ball Slam": "woodchop",
  "Rotational Med Ball Throw": "woodchop",
  "Pallof Press": "woodchop",

  "Suitcase Carry": "carry",
  "Front Rack Carry": "carry",
  "Overhead Carry": "carry",
  "Power Clean": "clean",
  "Hang Clean": "clean",
  "Kettlebell Clean": "clean",
  "Kettlebell Snatch": "clean",
  "Bird Dog": "quadruped",
  "Bear Crawl": "quadruped",
  "Mountain Climbers": "mountainClimber",
  "Dumbbell Front Raise": "frontRaise",
  "Triceps Kickback": "kickback",
  "Leg Extension": "legExtension",
};

// The library implement, translated for the 3D demo. Cable counts as machine
// (a stack with a handle), band and bodyweight draw nothing special.
function viewerImplementFor(implement: LibraryImplement): ViewerImplement {
  if (implement === "cable") return "machine";
  if (implement === "band" || implement === "bodyweight") return undefined;
  return implement;
}

function libraryExerciseToWorkoutExercise(
  exercise: LibraryExercise,
  profile: Record<string, string>,
  exerciseProgress: Record<string, ExerciseProgress>,
  isDeload: boolean,
  weightModifier: number,
): WorkoutExercise {
  const range = baseRepRangeForProfile(profile);
  const saved = exerciseProgress[exercise.name]
    ? normalizeExerciseProgress(exerciseProgress[exercise.name]!, range)
    : null;
  const implement = implementForExerciseName(exercise.name);
  const isUnloaded = exercise.implement === "bodyweight" || exercise.implement === "band";

  const startingKg = exercise.startingKg ?? 0;
  const weight = isUnloaded
    ? "Bodyweight"
    : saved && hasEarnedWeight(saved)
      ? `${snapToLoadableWeight(saved.weightKg * (isDeload ? 0.85 : weightModifier), implement)} kg`
      : scaledStartingWeightLabel(
          startingKg * experienceLoadFactor(profile) * (isDeload ? 0.85 : weightModifier),
          Number(profile.weight),
          implement,
        );

  return {
    name: exercise.name,
    target: `${exercise.primaryMuscle.replace("-", " ")} · ${exercise.pattern}`,
    weight,
    reps: exercise.isHold
      ? String(holdSecondsForProfile(profile))
      : String(saved ? saved.repsLow : range.low),
    repsHigh: exercise.isHold ? undefined : String(saved ? saved.repsHigh : range.high),
    implement: isUnloaded ? undefined : implement,
    weightPerHand: !isUnloaded && exercise.perHand === true,
    repsPerSide: exercise.isHold || !exercise.unilateral ? undefined : (perSideUnitLabel(exercise.name, exercise.primaryMuscle) ?? undefined),
    isHold: exercise.isHold,
    pose: POSE_FOR_EXERCISE[exercise.name] ? exercisePoses[POSE_FOR_EXERCISE[exercise.name]!] : undefined,
    demoImplement: viewerImplementFor(exercise.implement),
    tempo: exercise.isHold ? "HOLD" : "3-1-1",
    phases: exercise.isHold ? ["BRACE", "HOLD", "HOLD"] : ["LOWER", "BRACE", "LIFT"],
    cue: exercise.cue,
  };
}

// The library result shaped like a catalog result, so the caller doesn't need
// to know which source answered. Returns null only if the library somehow
// can't fill four slots, which sends the caller to the original hardcoded
// roster as a last resort.
function libraryWorkout(
  profile: Record<string, string>,
  splitDay: SplitDay,
  splitLabel: string,
  exerciseProgress: Record<string, ExerciseProgress>,
  isDeload: boolean,
  weightModifier: number,
  sessionIndex: number,
  blockIndex: number,
): {
  exercises: WorkoutExercise[];
  splitLabel: string;
  splitDay: SplitDay;
  isDeload: boolean;
  weightModifier: number;
} | null {
  const exercises = buildProgramFromLibrary(
    profile,
    splitDay,
    exerciseProgress,
    isDeload,
    weightModifier,
    sessionIndex,
    blockIndex,
  );
  if (exercises.length < 4) return null;
  return { exercises, splitLabel, splitDay, isDeload, weightModifier };
}

// Builds a session from the local library, with no network involved.
//
// This is what runs when the catalog is unreachable, which -- while it is
// rate-limited -- is most of the time. It replaces a set of hardcoded rosters
// that offered six or seven movements per equipment tier and ignored goal,
// difficulty and most limitations.
//
// Media is attached where the app already ships footage for that movement by
// name; everything else carries its written cue. Mixing the two is the point:
// a demo where one exists beats text, and text beats a photo of a different
// exercise.
// Which implements a tier should actually reach for.
//
// Without this, picking was decided by declaration order: a full-gym lifter got
// a bodyweight lunge because it happened to be written first in the library.
// Answering "full gym" and being handed bodyweight work reads as the program
// not listening.
const IMPLEMENT_PREFERENCE: Record<EquipmentTier, Record<LibraryImplement, number>> = {
  gym: { barbell: 20, dumbbell: 17, machine: 14, cable: 14, kettlebell: 12, other: 8, bodyweight: 6, band: 3 },
  "home-gym": { dumbbell: 20, barbell: 18, kettlebell: 16, band: 10, bodyweight: 9, other: 8, machine: 4, cable: 4 },
  minimal: { dumbbell: 20, kettlebell: 18, band: 14, bodyweight: 12, other: 8, barbell: 2, machine: 0, cable: 0 },
  bars: { bodyweight: 20, band: 12, other: 8, dumbbell: 4, kettlebell: 4, barbell: 0, machine: 0, cable: 0 },
  bodyweight: { bodyweight: 20, band: 8, other: 6, dumbbell: 0, kettlebell: 0, barbell: 0, machine: 0, cable: 0 },
};

// What each goal wants from a movement, layered on top of the equipment the
// user actually has. The tier preference alone is goal-blind, so a gym member
// got barbells whatever they had chosen -- five goals produced identical
// sessions, differing only in reps and rest.
//
// Strength leans into the bar. Fat-loss and athletic training want load that
// moves, so they reach for kettlebells and bodyweight and away from fixed
// machines. Hypertrophy prefers the dumbbell and cable work that lets a muscle
// be loaded through its range.
// `other` is not a leftover bucket here -- it is the conditioning and power
// equipment: sled, battle ropes, medicine balls. It was the one implement the
// table had no opinion about, which left every piece of it scoring the same
// flat number for all five goals and stranded permanently just outside the
// rotation band. Sleds and ropes belong in a fat-loss or athletic session far
// more than in a hypertrophy one.
const GOAL_IMPLEMENT_BIAS: Record<string, Partial<Record<LibraryImplement, number>>> = {
  strength: { barbell: 12, other: 2, machine: -4, cable: -2, band: -8, bodyweight: -4 },
  athletic: { other: 12, kettlebell: 10, bodyweight: 8, dumbbell: 2, cable: -4, machine: -10 },
  muscle: { dumbbell: 8, cable: 10, machine: 10, barbell: 2, band: -4, other: -6 },
  "fat-loss": { kettlebell: 12, other: 12, bodyweight: 8, dumbbell: 2, barbell: -6, machine: -6 },
  fitness: { dumbbell: 6, bodyweight: 6, kettlebell: 6, other: 6, barbell: -2 },
  health: { dumbbell: 6, bodyweight: 4, machine: 2 },
};

// How many comparable alternatives a slot cycles through across sessions.
//
// Scoring alone is deterministic, so the highest-scoring exercise won its slot
// every single time: the same profile built the same session forever. Rotation
// is driven by how many sessions of this split day are already logged, not by
// randomness -- the same history must always rebuild the same session, or a
// re-render mid-workout would reshuffle the exercises under the user.
//
// The spine barely moves for strength. Progressive overload needs the same
// lift week after week, and a bench press that comes round every third session
// progresses at a third of the rate. Accessory slots rotate freely, because
// that is where staleness is actually felt.
// How far below the best a candidate may score and still be rotated to. This
// is the real quality control: a worse exercise is not variety, it is a worse
// exercise.
const VARIETY_SCORE_BAND = 12;

// Someone training twice a week meets the same session far more often than
// someone on a six-day split, where the split days themselves supply the
// variety. Fewer days, slightly wider tolerance.
const INFREQUENT_BAND_BONUS = 4;

// Rotation depth, as a deliberate restriction rather than a default.
//
// The band above already guarantees every candidate in it is comparable to the
// best, so there is no quality argument for also excluding options the band has
// accepted -- that was leaving perfectly good exercises permanently unreachable
// on a technicality of ordering. `null` means rotate through the whole band.
//
// Strength is the one goal that restricts: one main lift, kept for as long as
// it is still progressing. That is not a limitation of the programme, it is the
// programme. Accessories always rotate through the whole band.
const GOAL_SPINE_DEPTH: Record<string, number | null> = {
  strength: 1,
  athletic: null,
  muscle: null,
  "fat-loss": null,
  fitness: null,
  health: null,
};

// On a compound lift a free weight beats a machine, and the tier preference
// says so. On isolation that ranking inverts: a cable holds tension through the
// whole range where a dumbbell gives it up at the top, which is the entire
// point of isolating a muscle. Applied only in isolation slots.
const ISOLATION_IMPLEMENT_BIAS: Partial<Record<LibraryImplement, number>> = {
  cable: 14,
  machine: 10,
  band: 6,
  bodyweight: -2,
  barbell: -4,
};

const LIBRARY_DIFFICULTY_RANK = { novice: 0, beginner: 1, intermediate: 2, advanced: 3 };

// Difficulty is a target, not a ceiling.
//
// The previous rule only capped how hard an exercise could be, so the easiest
// qualifying movement won whenever it was declared first -- an intermediate
// lifter was offered novice work. Distance from their level is now scored in
// both directions, asymmetrically: too hard risks injuring someone, too easy
// only wastes a slot, so overshooting is penalised harder than undershooting.
function libraryPickScore(
  exercise: LibraryExercise,
  tier: EquipmentTier,
  targetDifficulty: number,
  goal: string | undefined,
  isolationSlot: boolean = false,
): number {
  const rank = LIBRARY_DIFFICULTY_RANK[exercise.difficulty];
  // Overshooting stays uncapped -- an exercise two levels too hard is twice the
  // problem. Undershooting is capped, because past a point it stops meaning
  // anything: "simple" and "unsuitable" are different, and a leg press is not
  // a beginner's exercise, it is a simple one. Uncapped, every novice-graded
  // machine sat 27 points down for an advanced lifter and could never place.
  const distance =
    rank > targetDifficulty
      ? (rank - targetDifficulty) * 22
      : Math.min(12, (targetDifficulty - rank) * 9);
  return (
    60 -
    distance +
    (IMPLEMENT_PREFERENCE[tier][exercise.implement] ?? 0) +
    (GOAL_IMPLEMENT_BIAS[goal ?? ""]?.[exercise.implement] ?? 0) +
    (isolationSlot ? ISOLATION_IMPLEMENT_BIAS[exercise.implement] ?? 0 : 0) +
    // Only 34 of 153 exercises name a goal at all, so this separates the few
    // that do and nothing else. The bias above is what actually shapes a
    // session towards its goal.
    (suitsGoal(exercise, goal) ? 15 : 0)
  );
}

function buildProgramFromLibrary(
  profile: Record<string, string>,
  splitDay: SplitDay,
  exerciseProgress: Record<string, ExerciseProgress>,
  isDeload: boolean,
  weightModifier: number,
  // How many sessions of this split day are already logged. Drives accessory rotation.
  sessionIndex: number = 0,
  // Which four-week block the user is in. Drives main-lift rotation.
  blockIndex: number = 0,
  // Names to treat as already taken. Used when the limitation veto has removed
  // exercises and the session needs refilling with movements it hasn't already
  // rejected.
  exclude: ReadonlySet<string> = new Set(),
): WorkoutExercise[] {
  const tier = (["gym", "home-gym", "minimal", "bodyweight", "bars"] as EquipmentTier[]).includes(
    profile.equipment as EquipmentTier,
  )
    ? (profile.equipment as EquipmentTier)
    : "minimal";
  const limitations = splitAnswerValues(profile.limitations);
  const targetDifficulty = { beginner: 1, novice: 1, intermediate: 2, advanced: 3 }[
    profile.experience ?? ""
  ] ?? 1;
  const bodyweightStrength =
    profile.bodyweightStrength === "both" ||
    profile.bodyweightStrength === "pushups" ||
    profile.bodyweightStrength === "neither"
      ? profile.bodyweightStrength
      : undefined;

  const eligible = exercisesForTier(tier).filter((exercise) => {
    // Injury safety is the one hard filter -- everything else can bend rather
    // than leave a slot empty.
    if (limitations.includes("knee") && !exercise.injurySafe.kneeSafe) return false;
    if (limitations.includes("shoulder") && !exercise.injurySafe.shoulderSafe) return false;
    if (limitations.includes("back") && !exercise.injurySafe.backSafe) return false;
    // Shared with the catalog path so the two sources agree about who should
    // be shown a regression and who should be shown the real movement.
    if (!suitsBodyweightCapability(exercise.name, bodyweightStrength)) return false;
    return true;
  });

  const slots = splitDaySlots(splitDay, profile.goal);
  const used = new Set<string>(exclude);
  const chosen: LibraryExercise[] = [];

  const spineDepth = GOAL_SPINE_DEPTH[profile.goal ?? ""] ?? null;
  const spineLength = splitDaySpineLength(splitDay);
  const frequency = Number(profile.frequency);
  const scoreBand =
    VARIETY_SCORE_BAND + (Number.isFinite(frequency) && frequency <= 3 ? INFREQUENT_BAND_BONUS : 0);

  slots.forEach((slot, slotIndex) => {
    const inPattern = eligible.filter(
      (exercise) => exercise.pattern === slot.pattern && !used.has(exercise.name),
    );
    // An isolation slot takes single-joint work only; a compound slot prefers
    // not to. Both fall back rather than leave the slot empty -- a tier with no
    // isolation for this pattern still gets an exercise.
    const wanted = inPattern.filter((exercise) => Boolean(exercise.isolation) === slot.isolation);
    const forPattern = wanted.length ? wanted : inPattern;
    // Score every candidate rather than taking the first that clears a bar:
    // a thin pattern still yields its best available option instead of
    // whichever movement happened to be written first. Sort is stable, so ties
    // fall back to library order and the ranking is reproducible.
    const ranked = forPattern
      .map((exercise) => ({
        exercise,
        score: libraryPickScore(exercise, tier, targetDifficulty, profile.goal, slot.isolation),
      }))
      .sort((a, b) => b.score - a.score);

    // Rotate, but only among options close enough to the best that swapping
    // between them costs nothing.
    //
    // Spine and accessory rotate on different clocks. Accessories change every
    // session -- that is where staleness is felt. Main lifts change per
    // four-week block, so there is time to actually add weight to one before it
    // is replaced.
    const best = ranked[0];
    const isSpine = slotIndex < spineLength;
    const depth = isSpine ? spineDepth : null;
    const rotationIndex = isSpine ? blockIndex : sessionIndex;
    const inBand = best
      ? ranked.filter((candidate) => candidate.score >= best.score - scoreBand)
      : [];
    const choices = depth === null ? inBand : inBand.slice(0, Math.max(1, depth));
    // Index alone, with no slot offset: a first session should be the
    // best-scoring one available, not an arbitrary position in the cycle. Two
    // slots sharing a pattern still diverge, because the first pick is removed
    // from the pool before the second slot ranks it.
    const pick = choices.length ? choices[rotationIndex % choices.length]!.exercise : undefined;
    if (pick) {
      chosen.push(pick);
      used.add(pick.name);
    }
  });

  // A leg day for someone with a bad knee can't fill five knee-dominant slots,
  // and a session that comes back short is dropped entirely for the old
  // hardcoded roster -- so the users with the most reason to need a tailored
  // programme were the ones least likely to get one. Unfilled slots are backed
  // by whatever else the library can safely offer them, best-scoring first.
  if (chosen.length < slots.length) {
    const backfill = eligible
      .filter((exercise) => !used.has(exercise.name))
      .map((exercise) => ({
        exercise,
        score: libraryPickScore(exercise, tier, targetDifficulty, profile.goal),
      }))
      .sort((a, b) => b.score - a.score);
    for (const { exercise } of backfill) {
      if (chosen.length >= slots.length) break;
      chosen.push(exercise);
      used.add(exercise.name);
    }
  }

  return chosen.map((exercise) =>
    libraryExerciseToWorkoutExercise(exercise, profile, exerciseProgress, isDeload, weightModifier),
  );
}

// Milliseconds for one direction of the loop. Slow enough to read the shape,
// quick enough not to feel like the screen has stalled.
// Per step between key positions, so a five-position clean is not crammed into
// the time a two-position plank takes.
const POSE_PHASE_MS = 900;

// The frame the existing poses were drawn against. Only the ratio matters --
// it keeps a squat from being stretched when the container is a different shape.
const POSE_UNIT_WIDTH = 850;
const POSE_UNIT_HEIGHT = 567;
const POSE_ASPECT = POSE_UNIT_WIDTH / POSE_UNIT_HEIGHT;

// Draws a PoseGuide as a stick figure and animates start -> finish -> start.
//
// The data model and the styles for this were already in the file; nothing
// rendered them, so 159 exercises fell back to a written cue. A figure is not a
// technique demo -- it cannot show bar path or grip -- but it answers "what is
// this movement", which a paragraph of text does slowly and a photo of a
// different exercise does wrongly.
function PoseFigure({ pose }: { pose: ExercisePose }) {
  const progress = useRef(new Animated.Value(0)).current;
  const reduceMotion = useReducedMotion();
  const [size, setSize] = useState({ width: 0, height: 0 });
  const frames = pose.frames;
  const lastIndex = frames.length - 1;

  useEffect(() => {
    if (reduceMotion) {
      // Land on the last key position rather than skipping the figure: the end
      // of the movement is the more informative half of most exercises.
      progress.setValue(1);
      return;
    }
    // One pass through the key positions and back is one repetition, so a
    // movement with more of them takes proportionally longer rather than
    // rushing through the extra detail.
    const duration = POSE_PHASE_MS * lastIndex;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
        Animated.timing(progress, { toValue: 0, duration, easing: Easing.inOut(Easing.quad), useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [progress, reduceMotion, lastIndex]);

  const { width, height } = size;
  // Evenly spaced stops, one per key position, for every interpolation below.
  const stops = useMemo(() => frames.map((_, i) => (lastIndex === 0 ? 0 : i / lastIndex)), [frames, lastIndex]);

  // Fit the whole movement -- every key position, figure and equipment -- to
  // the container. Fitting each position separately would make the figure jump
  // between them.
  const project = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const see = (x: number, y: number) => {
      minX = Math.min(minX, x); maxX = Math.max(maxX, x);
      minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    };
    for (const f of frames) {
      for (const s of f.segments) { see(s.x1, s.y1); see(s.x2, s.y2); }
      see(f.head.x - f.head.r / POSE_ASPECT, f.head.y - f.head.r);
      see(f.head.x + f.head.r / POSE_ASPECT, f.head.y + f.head.r);
      for (const prop of f.props) {
        if (prop.kind === "bar") {
          const a = (prop.angle * Math.PI) / 180;
          const hx = (Math.sin(a) * prop.length) / 2 / POSE_ASPECT;
          const hy = (-Math.cos(a) * prop.length) / 2;
          see(prop.x - hx, prop.y - hy); see(prop.x + hx, prop.y + hy);
        } else if (prop.kind === "bell") {
          see(prop.x - prop.size / 2 / POSE_ASPECT, prop.y - prop.size / 2);
          see(prop.x + prop.size / 2 / POSE_ASPECT, prop.y + prop.size / 2);
        } else if (prop.kind === "slab") {
          see(prop.x - prop.width / 2 / POSE_ASPECT, prop.y - prop.height / 2);
          see(prop.x + prop.width / 2 / POSE_ASPECT, prop.y + prop.height / 2);
        } else {
          // The floor spans the frame, so only its height matters to the fit --
          // letting its width into the box would shrink the figure to nothing.
          see(0.5, prop.y);
        }
      }
    }
    const unit = (x: number, y: number) => ({ x: x * POSE_UNIT_WIDTH, y: y * POSE_UNIT_HEIGHT });
    const topLeft = unit(minX, minY);
    const bottomRight = unit(maxX, maxY);
    const boxW = Math.max(bottomRight.x - topLeft.x, 1);
    const boxH = Math.max(bottomRight.y - topLeft.y, 1);
    const pad = 0.05;
    const scale = Math.min((width * (1 - pad * 2)) / boxW, (height * (1 - pad * 2)) / boxH);
    const cx = (topLeft.x + bottomRight.x) / 2;
    const cy = (topLeft.y + bottomRight.y) / 2;
    const to = (x: number, y: number) => {
      const p = unit(x, y);
      return { x: width / 2 + (p.x - cx) * scale, y: height / 2 + (p.y - cy) * scale };
    };
    // Lengths are authored against the frame height, so they scale with it.
    return { to, lengthPx: (l: number) => l * POSE_UNIT_HEIGHT * scale };
  }, [frames, width, height]);

  // Angles have to be unwrapped along the whole sequence, not pairwise: a bone
  // that turns past 180 degrees between two key positions would otherwise spin
  // the long way round to get to the third.
  const unwrap = (angles: number[]) => {
    const out = [angles[0] ?? 0];
    for (let i = 1; i < angles.length; i++) {
      let next = angles[i]!;
      const previous = out[i - 1]!;
      while (next - previous > 180) next -= 360;
      while (next - previous < -180) next += 360;
      out.push(next);
    }
    return out;
  };

  const bones = useMemo(() => {
    if (width === 0 || height === 0) return [];
    const count = Math.min(...frames.map((f) => f.segments.length));
    const out = [];
    for (let i = 0; i < count; i++) {
      const ends = frames.map((f) => {
        const s = f.segments[i]!;
        const a = project.to(s.x1, s.y1);
        const b = project.to(s.x2, s.y2);
        return { a, b, angle: (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI, length: Math.hypot(b.x - a.x, b.y - a.y) };
      });
      out.push({
        weight: frames[0]!.segments[i]!.weight,
        x: ends.map((e) => e.a.x),
        y: ends.map((e) => e.a.y),
        length: ends.map((e) => e.length),
        angle: unwrap(ends.map((e) => e.angle)),
      });
    }
    return out;
  }, [frames, width, height, project]);

  const head = useMemo(() => {
    if (width === 0 || height === 0) return null;
    const centres = frames.map((f) => project.to(f.head.x, f.head.y));
    const radii = frames.map((f) => project.lengthPx(f.head.r));
    return { x: centres.map((c) => c.x), y: centres.map((c) => c.y), r: radii };
  }, [frames, width, height, project]);

  // Equipment, matched by position in the list. `pose()` guarantees every key
  // position declares the same props in the same order.
  const props = useMemo(() => {
    if (width === 0 || height === 0) return [];
    const count = Math.min(...frames.map((f) => f.props.length));
    const out = [];
    for (let i = 0; i < count; i++) {
      const all = frames.map((f) => f.props[i]!);
      const kind = all[0]!.kind;
      if (all.some((p) => p.kind !== kind)) continue;
      if (kind === "floor") {
        out.push({ kind: "floor" as const, y: all.map((p) => project.to(0.5, (p as { y: number }).y).y) });
      } else if (kind === "bell") {
        const bells = all as Extract<PoseProp, { kind: "bell" }>[];
        const points = bells.map((p) => project.to(p.x, p.y));
        out.push({
          kind: "bell" as const,
          x: points.map((p) => p.x),
          y: points.map((p) => p.y),
          size: bells.map((p) => project.lengthPx(p.size)),
        });
      } else if (kind === "slab") {
        const slabs = all as Extract<PoseProp, { kind: "slab" }>[];
        const points = slabs.map((p) => project.to(p.x, p.y));
        out.push({
          kind: "slab" as const,
          x: points.map((p) => p.x),
          y: points.map((p) => p.y),
          w: slabs.map((p) => project.lengthPx(p.width)),
          h: slabs.map((p) => project.lengthPx(p.height)),
        });
      } else {
        const bars = all as Extract<PoseProp, { kind: "bar" }>[];
        const points = bars.map((p) => project.to(p.x, p.y));
        out.push({
          kind: "bar" as const,
          plates: bars[0]!.plates,
          x: points.map((p) => p.x),
          y: points.map((p) => p.y),
          length: bars.map((p) => project.lengthPx(p.length)),
          angle: unwrap(bars.map((p) => p.angle - 90)),
        });
      }
    }
    return out;
  }, [frames, width, height, project]);

  const track = (values: number[]) =>
    values.length < 2 ? values[0] ?? 0 : progress.interpolate({ inputRange: stops, outputRange: values });
  const trackDeg = (values: number[]) =>
    values.length < 2
      ? `${values[0] ?? 0}deg`
      : progress.interpolate({ inputRange: stops, outputRange: values.map((v) => `${v}deg`) });
  const offset = (values: number[], by: number[]) => track(values.map((v, i) => v - (by[i] ?? 0)));
  const half = (values: number[]) => values.map((v) => v / 2);

  return (
    <View style={styles.poseFrameHost}>
      <View
        style={styles.poseCanvas}
        onLayout={(event) => {
          const { width: w, height: h } = event.nativeEvent.layout;
          setSize((current) => (current.width === w && current.height === h ? current : { width: w, height: h }));
        }}
      >
        {/* Equipment first, so the figure reads on top of it. */}
        {props.map((prop, index) => {
          if (prop.kind === "floor") {
            return <Animated.View key={`prop-${index}`} style={[styles.poseFloor, { top: track(prop.y) }]} />;
          }
          if (prop.kind === "slab") {
            return (
              <Animated.View
                key={`prop-${index}`}
                style={[
                  styles.poseSlab,
                  {
                    left: offset(prop.x, half(prop.w)),
                    top: offset(prop.y, half(prop.h)),
                    width: track(prop.w),
                    height: track(prop.h),
                  },
                ]}
              />
            );
          }
          if (prop.kind === "bell") {
            return (
              <Animated.View
                key={`prop-${index}`}
                style={[
                  styles.poseBell,
                  {
                    left: offset(prop.x, half(prop.size)),
                    top: offset(prop.y, half(prop.size)),
                    width: track(prop.size),
                    height: track(prop.size),
                    borderRadius: track(half(prop.size)),
                  },
                ]}
              />
            );
          }
          return (
            <Fragment key={`prop-${index}`}>
              <Animated.View
                style={[
                  styles.poseBar,
                  {
                    left: offset(prop.x, half(prop.length)),
                    top: track(prop.y),
                    width: track(prop.length),
                    transform: [{ rotate: trackDeg(prop.angle) }],
                  },
                ]}
              />
              {prop.plates
                ? [-1, 1].map((side) => (
                    <Animated.View
                      key={`plate-${index}-${side}`}
                      style={[
                        styles.posePlate,
                        { left: track(prop.x.map((x, i) => x + (side * prop.length[i]!) / 2)), top: track(prop.y) },
                      ]}
                    />
                  ))
                : null}
            </Fragment>
          );
        })}

        {/* Far limbs, then the trunk, then the near limbs: without that order a
            side view is a pile of identical sticks with no depth. */}
        {(["far", "core", "near"] as const).map((weight) =>
          bones
            .map((bone, index) => ({ bone, index }))
            .filter(({ bone }) => bone.weight === weight)
            .map(({ bone, index }) => (
              <Animated.View
                key={`bone-${index}`}
                style={[
                  weight === "far" ? styles.poseLineFar : weight === "core" ? styles.poseLineCore : styles.poseLine,
                  {
                    left: track(bone.x),
                    top: track(bone.y),
                    width: track(bone.length),
                    // A bone is placed by its start point, so it turns about
                    // that end. StyleSheet.create drops this property, so it
                    // has to be set here.
                    transformOrigin: "left center",
                    transform: [{ rotate: trackDeg(bone.angle) }],
                  },
                ]}
              />
            )),
        )}

        {head ? (
          <Animated.View
            style={[
              styles.poseHead,
              {
                left: offset(head.x, head.r),
                top: offset(head.y, head.r),
                width: track(head.r.map((r) => r * 2)),
                height: track(head.r.map((r) => r * 2)),
                borderRadius: track(head.r),
              },
            ]}
          />
        ) : null}
      </View>
    </View>
  );
}

// The class owns the canvas and the frame loop; this wrapper only gives it a
// place to live and tears it down. Web only -- native keeps the flat figure.
function PoseFigure3DWeb({
  pose,
  implement,
  interactive,
}: {
  pose: ExercisePose;
  implement: ViewerImplement;
  interactive: boolean;
}) {
  const hostRef = useRef<View>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    // On web a View ref is the underlying DOM element.
    const host = hostRef.current as unknown as HTMLElement | null;
    if (!host) return;
    const viewer = new PoseViewer3D(host, pose, implement, { interactive, reduceMotion });
    return () => viewer.dispose();
  }, [pose, implement, interactive, reduceMotion]);

  return <View ref={hostRef} style={styles.pose3dHost} />;
}

function ExerciseCueCard({ exercise }: { exercise: WorkoutExercise }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <View style={styles.cueCard}>
      {exercise.pose ? (
        Platform.OS === "web" ? (
          <>
            <Pressable
              style={styles.cueCardFigure}
              onPress={() => setExpanded(true)}
              accessibilityRole="button"
              accessibilityLabel="Expand the exercise demo"
            >
              <PoseFigure3DWeb pose={exercise.pose} implement={exercise.demoImplement ?? exercise.implement} interactive={false} />
              {/* The rotate affordance is a real chip, not a whisper in the
                  corner -- people should see the feature the moment the
                  first exercise appears. */}
              <View style={styles.poseExpandHint} pointerEvents="none">
                <Text style={styles.poseExpandHintIcon}>⟳</Text>
                <Text style={styles.poseExpandHintText}>TAP TO ROTATE</Text>
              </View>
            </Pressable>
            {/* Fullscreen: the same movement with the camera handed to the
                user -- drag to rotate, scroll or pinch to zoom. */}
            {/* animationType="none": the fade is JS-driven on web and starves
                next to two WebGL canvases -- it sat at 11% opacity. */}
            <Modal visible={expanded} transparent animationType="none" onRequestClose={() => setExpanded(false)}>
              <View style={styles.poseModalBackdrop}>
                <View style={styles.poseModalStage}>
                  <PoseFigure3DWeb pose={exercise.pose} implement={exercise.demoImplement ?? exercise.implement} interactive />
                </View>
                <View style={styles.poseModalHeader} pointerEvents="box-none">
                  {/* flex 1 so a long hint wraps instead of shoving the close
                      button off the right edge of a narrow screen. */}
                  <View style={styles.poseModalTitles}>
                    <Text style={styles.poseModalName}>{exercise.name}</Text>
                    <Text style={styles.poseModalHint}>DRAG TO ROTATE · PINCH OR SCROLL TO ZOOM</Text>
                  </View>
                  <Pressable style={styles.poseModalClose} onPress={() => setExpanded(false)} accessibilityRole="button">
                    <Text style={styles.poseModalCloseText}>✕</Text>
                  </Pressable>
                </View>
              </View>
            </Modal>
          </>
        ) : (
          <View style={styles.cueCardFigure}>
            <PoseFigure pose={exercise.pose} />
          </View>
        )
      ) : (
        <Text style={styles.cueCardBadge}>NO DEMO YET</Text>
      )}
      <Text style={styles.cueCardName}>{exercise.name}</Text>
      <Text style={styles.cueCardTarget}>{exercise.target}</Text>
      {exercise.cue ? <Text style={styles.cueCardText}>{exercise.cue}</Text> : null}
    </View>
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

  return (
    <View style={styles.demoStage}>
      <ExerciseCueCard exercise={exercise} />
    </View>
  );
}

function ActiveWorkoutScreen({
  exercises,
  splitLabel,
  splitDay,
  isDeload,
  weightModifier = 1,
  vetoedCount = 0,
  adjustment,
  checkIn,
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
  vetoedCount?: number;
  adjustment?: CoachScenario | null;
  checkIn?: DailyCheckIn | null;
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
  const targetSetCount = setCountForProfile(profile, adjustment, isDeload, checkIn);
  // Honour the time the user said they have. This replaces a flat "keep three
  // exercises" for the coach's time adjustment: the budget is the same 30
  // minutes, but how much actually fits into it depends on the rest interval
  // their goal calls for and how many sets they're doing.
  const personalizedExercises = fitExercisesToDuration(
    baseExercises,
    targetSetCount,
    restSecondsForProfile(profile, adjustment),
    sessionBudgetMinutes(profile, adjustment),
  );
  const scrollRef = useRef<ScrollView>(null);

  const [exerciseIndex, setExerciseIndex] = useState(0);
  // What the user actually dialed in via the weight/reps picker this session,
  // keyed by exercise name -- separate from `exerciseProgress` (the
  // persisted, cross-session tracking state) so a live mid-session
  // adjustment doesn't have to masquerade as a finished progression record.
  // commitExerciseProgress reads from here (falling back to the exercise's
  // planned suggestion if the user never touched the picker) when it decides
  // whether this session earns progress.
  const [sessionLog, setSessionLog] = useState<Record<string, { weightKg: number; reps: number }>>({});
  const [completedSets, setCompletedSets] = useState<boolean[]>(Array(targetSetCount).fill(false));
  const [restSeconds, setRestSeconds] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [workoutComplete, setWorkoutComplete] = useState(false);
  const [exerciseInfoOpen, setExerciseInfoOpen] = useState(false);
  const [swapState, setSwapState] = useState<"closed" | "loading" | { options: WorkoutExercise[] }>("closed");
  const exercise = personalizedExercises[exerciseIndex] ?? personalizedExercises[0]!;
  const isBodyweight = exercise.weight === "Bodyweight";
  const isHold = isHoldExercise(exercise);
  const currentWeightKg = isBodyweight ? null : parseFloat(exercise.weight);
  const currentReps = parseInt(exercise.reps, 10);
  const perHandLoad = !isBodyweight && exercise.weightPerHand === true;
  const perSideUnit = isHold ? null : (exercise.repsPerSide ?? null);
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
    460,
    Math.max(Math.min(300, Math.round(height * 0.42)), height - 58 - deloadBannerHeight - (sheetHeight || 460) - 18),
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
    setSessionLog((current) => ({ ...current, [exercise.name]: { weightKg: nextWeightKg, reps: nextReps } }));
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
  // the last one). Double progression against a target RANGE, not a fixed
  // number: the suggested reps shown is always the conservative bottom of
  // the range (repsLow); only logging the TOP of the range (repsHigh) on
  // every prescribed set, two sessions in a row, earns an advance. One
  // strong session never counts on its own (streak just needs to reach 2),
  // and a rough or incomplete session never costs anything beyond resetting
  // that streak -- the range and weight stay exactly where they were.
  // Progresses from what was actually logged this session (sessionLog,
  // live-updated by the kg/reps picker below) rather than the exercise's
  // original planned suggestion, falling back to that suggestion only if the
  // user never touched the picker (i.e. they did exactly what was asked).
  const commitExerciseProgress = (finishedExercise: WorkoutExercise) => {
    const isBW = finishedExercise.weight === "Bodyweight";
    const startRange = baseRepRangeForProfile(profile);
    const plannedWeightKg = isBW ? 0 : parseFloat(finishedExercise.weight);
    const savedProgress = exerciseProgress[finishedExercise.name];
    const previous: ExerciseProgress = savedProgress
      ? normalizeExerciseProgress(savedProgress, startRange)
      : {
          weightKg: Number.isFinite(plannedWeightKg) ? plannedWeightKg : 0,
          repsLow: startRange.low,
          repsHigh: startRange.high,
          streak: 0,
          totalAdvances: 0,
        };
    const loggedThisSession = sessionLog[finishedExercise.name];
    const loggedReps = loggedThisSession ? loggedThisSession.reps : parseInt(finishedExercise.reps, 10);
    const loggedWeightKg = loggedThisSession ? loggedThisSession.weightKg : plannedWeightKg;
    if (!Number.isFinite(loggedReps)) return;

    const allSetsCompleted = completedSets.length > 0 && completedSets.every(Boolean);
    const hitTop = allSetsCompleted && loggedReps >= previous.repsHigh;

    if (!hitTop) {
      onUpdateExerciseProgress(finishedExercise.name, { ...previous, streak: 0 });
      return;
    }

    const streak = previous.streak + 1;
    if (streak < advanceSessionsForProfile(profile)) {
      onUpdateExerciseProgress(finishedExercise.name, { ...previous, streak });
      return;
    }

    // Two strong sessions in a row -- advance, gradually. Weighted exercises
    // step up to the next weight that actually exists for their implement
    // (a flat +1kg would keep landing on dumbbells no gym stocks) and the
    // range resets to try again there; bodyweight exercises have no weight to
    // add, so the whole range shifts up by one rep instead -- same idea.
    if (isBW) {
      onUpdateExerciseProgress(finishedExercise.name, {
        weightKg: 0,
        repsLow: previous.repsLow + 1,
        repsHigh: previous.repsHigh + 1,
        streak: 0,
        totalAdvances: previous.totalAdvances,
      });
    } else {
      const totalAdvances = previous.totalAdvances + 1;
      // Graduation: a weighted exercise that started elevated above the
      // goal's real range (the beginner/novice safety floor) eases back
      // toward it one rep at a time as real advances accumulate -- never in
      // one jump, and it never overshoots below the goal's own target.
      const target = goalRepRange(profile);
      const canStepDown = previous.repsLow > target.low && totalAdvances % ADVANCES_PER_GRADUATION_STEP === 0;
      const nextRepsLow = canStepDown ? previous.repsLow - 1 : previous.repsLow;
      const nextRepsHigh = canStepDown ? previous.repsHigh - 1 : previous.repsHigh;
      const baseWeightKg = Number.isFinite(loggedWeightKg) ? loggedWeightKg : previous.weightKg;
      onUpdateExerciseProgress(finishedExercise.name, {
        weightKg: nextLoadableWeight(
          baseWeightKg,
          finishedExercise.implement ?? implementForExerciseName(finishedExercise.name),
        ),
        repsLow: nextRepsLow,
        repsHigh: nextRepsHigh,
        streak: 0,
        totalAdvances,
      });
    }
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
        // `weight` reads "Bodyweight" for unloaded work, which parseFloat turns
        // into NaN. The name list alone missed everything the library added --
        // a Russian twist and a V-up are unloaded and neither is in it -- and a
        // NaN slipped past the downstream `<= 0` guard to be rendered as "1 kg".
        weightKg: unloadedExerciseWeight(item) ? null : parseFloat(item.weight),
        reps: parseInt(item.reps, 10),
        sets: targetSetCount,
        weightPerHand: item.weightPerHand === true,
        isHold: isHoldExercise(item),
        ...(item.repsPerSide ? { repsPerSide: item.repsPerSide } : {}),
      })),
      ...(Number.isFinite(Number(profile.weight)) && Number(profile.weight) > 0
        ? { bodyWeightKg: Number(profile.weight) }
        : {}),
      ...(Number(profile.frequency) > 0 ? { weeklyTarget: Number(profile.frequency) } : {}),
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
  const remainingLabel = clockLabel(remainingSeconds);
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
              {nextFocusForGoal(profile.goal)}
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

      {vetoedCount > 0 ? (
        <View style={styles.vetoBanner}>
          <Text style={styles.vetoBannerText}>
            {vetoedCount} EXERCISE{vetoedCount === 1 ? "" : "S"} REMOVED FOR YOUR LIMITATION
          </Text>
          {/* A session this thin means the limitation rules out most of what
              we can offer. Saying so beats letting it look like a bug, and a
              person should look at it rather than the app quietly carrying on. */}
          {personalizedExercises.length < MIN_EXERCISES_PER_SESSION ? (
            <Text style={styles.vetoBannerHint}>
              That leaves a very short session. Ask your coach to review this in the Coach tab.
            </Text>
          ) : null}
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        style={styles.activeWorkoutScroll}
        contentContainerStyle={styles.activeWorkoutScrollContent}
        showsVerticalScrollIndicator={false}
      >
      <View style={[styles.exerciseVisual, { height: exerciseVisualHeight }]}>
        {/* The glow wraps the WHOLE figure: sized to the stage, not a fixed
            210px puck the body pokes out of. */}
        <View
          style={[
            styles.exerciseGlow,
            {
              width: Math.round(exerciseVisualHeight * 0.94),
              height: Math.round(exerciseVisualHeight * 0.94),
              borderRadius: Math.round(exerciseVisualHeight * 0.47),
            },
          ]}
        />
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
              <Text style={styles.restValue}>{clockLabel(restSeconds)}</Text>
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
          <Text style={[styles.setHeaderText, styles.weightColumn]}>
            WEIGHT{perHandLoad ? " / HAND" : ""}
          </Text>
          <Text style={[styles.setHeaderText, styles.repsColumn]}>
            {isHold ? "SEC" : "REPS"}
            {perSideUnit ? ` / ${perSideUnit.toUpperCase()}` : ""}
          </Text>
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
                {isHold
                  ? `${exercise.reps}s`
                  : exercise.repsHigh && exercise.repsHigh !== exercise.reps
                    ? `${exercise.reps}–${exercise.repsHigh}`
                    : exercise.reps}
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
                    ? `HOW MANY REPS DID YOU DO${perSideUnit ? ` PER ${perSideUnit.toUpperCase()}` : ""}`
                    : "HOW MANY KG & REPS DID YOU DO"}
              </Text>
              <View style={styles.adjustPanelPickers}>
                {!isBodyweight ? (
                  <View style={styles.adjustPanelSlot}>
                    <Text style={styles.adjustPanelColumnLabel}>
                      WEIGHT{perHandLoad ? " / HAND" : ""}
                    </Text>
                    <NumberWheelPicker
                      key={`${exercise.name}-weight`}
                      itemHeight={26}
                      visibleItems={3}
                      fontSize={16}
                      min={2}
                      max={100}
                      step={1}
                      values={loadableWeightOptions(
                        exercise.implement ?? implementForExerciseName(exercise.name),
                      )}
                      unit="kg"
                      value={currentWeightKg ?? 20}
                      onChange={(next) => saveExerciseAdjustment(next, currentReps)}
                    />
                  </View>
                ) : null}
                <View style={styles.adjustPanelSlot}>
                  <Text style={styles.adjustPanelColumnLabel}>
                    {isHold ? "SEC" : "REPS"}
                    {perSideUnit ? ` / ${perSideUnit.toUpperCase()}` : ""}
                  </Text>
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
                  <View style={styles.swapOptionThumb} />
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
  exerciseProgress,
  earnedBadges,
}: {
  onDashboard: () => void;
  onStartWorkout: () => void;
  onOpenNutrition: () => void;
  onOpenCoach: () => void;
  profile: Record<string, string>;
  workoutHistory: WorkoutHistoryEntry[];
  exerciseProgress: Record<string, ExerciseProgress>;
  earnedBadges: EarnedBadges;
}) {
  const nextFocus = nextFocusForGoal(profile.goal);

  const totalWorkouts = workoutHistory.length;
  const hasHistory = totalWorkouts > 0;
  const thisWeekCount = workoutHistory.filter((entry) => isWithinLastDays(entry.date, 7)).length;
  const totalSets = workoutHistory.reduce((sum, entry) => sum + entry.sets, 0);
  const totalSeconds = workoutHistory.reduce((sum, entry) => sum + entry.seconds, 0);

  const bodyWeightKg = Number(profile.weight);
  const totalVolumeKg = workoutHistory.reduce(
    (sum, entry) => sum + entryVolumeKg(entry, bodyWeightKg),
    0,
  );
  const comparison = volumeComparison(totalVolumeKg);
  const totalReps = workoutHistory.reduce(
    (sum, entry) =>
      sum + (entry.exerciseBreakdown ?? []).reduce((inner, item) => inner + exerciseRepCount(item), 0),
    0,
  );
  const progressEntries = Object.entries(exerciseProgress);
  const totalAdvances = progressEntries.reduce(
    (sum, [, entry]) => sum + (entry.totalAdvances ?? 0),
    0,
  );
  // Two sources, in order of how much they can be trusted.
  //
  // An advanced record is authoritative: the weight was earned and reflects
  // real progression. A record with no advances behind it only mirrors
  // whatever the plan suggested (see hasEarnedWeight), and for records written
  // before starting weights were fixed that suggestion could be wrong -- which
  // is why those aren't read here at all.
  //
  // Instead, un-advanced lifts fall back to what the most recent session
  // actually prescribed. That is recorded per workout, so it is current by
  // construction, and it means a lift appears here after the first completed
  // session rather than waiting on an advance that takes weeks.
  const liftsByName = new Map<string, { weightKg: number; reps: number; gainedKg: number }>();
  for (const [name, entry] of progressEntries) {
    if (entry.weightKg > 0 && hasEarnedWeight(entry)) {
      liftsByName.set(name, { weightKg: entry.weightKg, reps: entry.repsLow, gainedKg: entry.totalAdvances });
    }
  }
  // Newest first, so the first sighting of an exercise is its latest weight.
  for (const entry of workoutHistory) {
    for (const item of entry.exerciseBreakdown ?? []) {
      const weightKg = item.weightKg ?? 0;
      // Finite check as well as the range: a NaN passes `<= 0` and would be
      // snapped onto the bottom of a weight ladder and shown as "1 kg".
      if (liftsByName.has(item.name) || !Number.isFinite(weightKg) || weightKg <= 0) continue;
      liftsByName.set(item.name, { weightKg, reps: item.reps, gainedKg: 0 });
    }
  }

  const allLifts = [...liftsByName.entries()]
    .map(([name, lift]) => ({
      name,
      weightKg: snapToLoadableWeight(lift.weightKg, implementForExerciseName(name)),
      gainedKg: lift.gainedKg,
      standing: strengthStandingFor(name, lift.weightKg, lift.reps, bodyWeightKg, profile.sex),
    }))
    .sort((a, b) => b.weightKg - a.weightKg);
  const strongestLifts = allLifts.slice(0, 5);

  // One figure across every lift that could be placed against a standard, so
  // the headline card carries a comparison from the first session rather than
  // waiting on weeks of history.
  //
  // Averaged across lifts rather than taken from the best one: a single strong
  // movement shouldn't speak for someone's overall strength.
  const ratedStandings = allLifts.flatMap((lift) => (lift.standing ? [lift.standing.percentile] : []));
  const overallPercentile =
    ratedStandings.length > 0
      ? Math.round(ratedStandings.reduce((sum, value) => sum + value, 0) / ratedStandings.length)
      : null;

  const streakWeeks = weeklyStreak(workoutHistory);
  const weeklyVolume = weeklyVolumeSeries(workoutHistory, 8, bodyWeightKg);
  // Weeks when there are weeks to compare; sessions before that, so the card
  // carries a self-comparison from the second workout rather than the third week.
  const volumeTrend =
    weeklyVolumeTrend(weeklyVolume) ?? sessionVolumeTrend(workoutHistory, bodyWeightKg);
  const peakWeeklyVolume = Math.max(...weeklyVolume.map((week) => week.volumeKg), 1);
  const weeklyTarget = Math.max(1, Number(profile.frequency) || 3);
  const consistencyPercent = Math.min(100, Math.round((thisWeekCount / weeklyTarget) * 100));
  const badges = buildBadges(computeBadgeStats(workoutHistory, exerciseProgress, profile));
  // A badge counts as earned if it's met now OR was ever sealed as earned.
  const hasBadge = (badge: Badge) => isBadgeEarned(badge) || Boolean(earnedBadges[badge.id]);
  const earnedBadgeCount = badges.filter(hasBadge).length;
  const upcomingBadge = nextBadge(badges.filter((badge) => !hasBadge(badge)));

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

        {totalVolumeKg > 0 ? (
          <View style={styles.volumeCard}>
            <Text style={styles.volumeCardLabel}>TOTAL WEIGHT LIFTED</Text>
            <Text style={styles.volumeCardValue}>
              {Math.round(totalVolumeKg).toLocaleString()}
              <Text style={styles.volumeCardUnit}> kg</Text>
            </Text>
            {comparison ? <Text style={styles.volumeCardCompare}>That’s {comparison}.</Text> : null}

            {/* Unconditional: the standing stat always shows, with a dash when
                nothing can be rated, so this row can never be gated away. */}
            <View style={styles.volumeCardStats}>
              <View style={styles.volumeCardStat}>
                  <Text style={styles.volumeCardStatValue}>
                    {overallPercentile !== null ? `${overallPercentile}%` : "—"}
                  </Text>
                <Text style={styles.volumeCardStatLabel}>
                  STRONGER THAN · {profile.sex === "male" ? "MEN" : "WOMEN"}
                </Text>
              </View>
              {volumeTrend ? <View style={styles.volumeCardStatDivider} /> : null}
              {volumeTrend ? (
                <View style={styles.volumeCardStat}>
                  <Text style={styles.volumeCardStatValue}>
                    {volumeTrend.direction === "up" ? "↑" : "↓"}
                    {volumeTrend.percent}%
                  </Text>
                  <Text style={styles.volumeCardStatLabel}>
                    VS YOUR {volumeTrend.against.toUpperCase()}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.volumeCardFootnote}>
              {overallPercentile !== null
                ? "Across your lifts, against published strength standards for your bodyweight and sex — an estimate, not a ranking against other Project G users."
                : "No lift yet that a published standard covers. Squats, deadlifts, rows, presses and curls all count — a session of flys, carries and core work has nothing to measure against."}
            </Text>
          </View>
        ) : null}

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

        <View style={styles.progressMetrics}>
          <View style={styles.progressMetric}>
            <Text style={styles.progressMetricValue}>{totalReps.toLocaleString()}</Text>
            <Text style={styles.progressMetricLabel}>TOTAL REPS</Text>
          </View>
          <View style={styles.progressMetricDivider} />
          <View style={styles.progressMetric}>
            <Text style={styles.progressMetricValue}>{totalAdvances}</Text>
            <Text style={styles.progressMetricLabel}>LOADS EARNED</Text>
          </View>
          <View style={styles.progressMetricDivider} />
          <View style={styles.progressMetric}>
            <Text style={styles.progressMetricValue}>{streakWeeks > 0 ? `${streakWeeks}w` : "–"}</Text>
            <Text style={styles.progressMetricLabel}>WEEK STREAK</Text>
          </View>
        </View>

        <View style={styles.progressSection}>
          <Text style={styles.progressSectionTitle}>THIS WEEK</Text>
          <View style={styles.consistencyRow}>
            <Text style={styles.consistencyValue}>
              {thisWeekCount} <Text style={styles.consistencyTarget}>of {weeklyTarget}</Text>
            </Text>
            <Text style={styles.consistencyHint}>
              {thisWeekCount >= weeklyTarget
                ? "Target hit — everything from here is a bonus."
                : `${weeklyTarget - thisWeekCount} more to hit your target.`}
            </Text>
          </View>
          <View style={styles.consistencyTrack}>
            <View style={[styles.consistencyFill, { width: `${consistencyPercent}%` }]} />
          </View>
        </View>

        {totalVolumeKg > 0 ? (
          <View style={styles.progressSection}>
            <Text style={styles.progressSectionTitle}>WEEKLY VOLUME</Text>
            <View style={styles.volumeChart}>
              {weeklyVolume.map((week) => (
                <View key={week.weekStartMs} style={styles.volumeChartColumn}>
                  <View style={styles.volumeChartBarTrack}>
                    <View
                      style={[
                        styles.volumeChartBar,
                        // Always leave a sliver visible so an empty week reads
                        // as "nothing here" rather than a rendering gap.
                        { height: `${Math.max(2, (week.volumeKg / peakWeeklyVolume) * 100)}%` },
                        week.volumeKg === 0 && styles.volumeChartBarEmpty,
                      ]}
                    />
                  </View>
                  <Text style={styles.volumeChartLabel}>
                    {new Date(week.weekStartMs).toLocaleDateString(undefined, {
                      month: "numeric",
                      day: "numeric",
                    })}
                  </Text>
                </View>
              ))}
            </View>
            <Text style={styles.volumeChartCaption}>
              Kilograms lifted per week · peak {Math.round(peakWeeklyVolume).toLocaleString()} kg
            </Text>
          </View>
        ) : null}

        <View style={styles.progressSection}>
          <Text style={styles.progressSectionTitle}>YOUR LIFTS</Text>
          {strongestLifts.length > 0 ? (
            <>
              {strongestLifts.map((lift) => (
                <View key={lift.name} style={styles.liftRow}>
                  <View style={styles.liftCopy}>
                    <Text style={styles.liftName} numberOfLines={1}>
                      {lift.name}
                    </Text>
                    {lift.standing ? (
                      <Text style={styles.liftLevel}>
                        {lift.standing.level} · stronger than ~{lift.standing.percentile}% of{" "}
                        {profile.sex === "male" ? "men" : "women"}
                      </Text>
                    ) : null}
                  </View>
                  <View style={styles.liftRight}>
                    <Text style={styles.liftWeight}>{lift.weightKg} kg</Text>
                    {/* Only lifts that have actually advanced show a gain --
                        a starting weight hasn't gone up by anything yet. */}
                    {lift.gainedKg > 0 ? <Text style={styles.liftGain}>+{lift.gainedKg} kg</Text> : null}
                  </View>
                </View>
              ))}
              {strongestLifts.some((lift) => lift.standing) ? (
                <Text style={styles.liftLevelNote}>
                  Estimated from your working weight against your bodyweight, using published
                  strength standards for your sex — not a measurement, and not a comparison against
                  other Project G users.
                </Text>
              ) : null}
            </>
          ) : (
            <Text style={styles.progressEmptyText}>
              {workoutHistory.length > 0
                ? // Someone training unloaded has finished sessions and still has
                  // no working weights, so the "finish your first workout" line
                  // would be wrong for them after every single one.
                  "Nothing loaded yet — your sessions so far have been bodyweight. Working weights show up here once you train with a load."
                : "Finish your first workout and your working weights will show up here, with where each one sits for your bodyweight."}
            </Text>
          )}
        </View>

        <View style={styles.progressSection}>
          <View style={styles.badgeHeader}>
            <Text style={styles.progressSectionTitle}>ACHIEVEMENTS</Text>
            <Text style={styles.badgeCount}>
              {earnedBadgeCount} / {badges.length}
            </Text>
          </View>

          <View style={styles.badgeGrid}>
            {badges.map((badge) => {
              const earned = hasBadge(badge);
              return (
                <View
                  key={badge.id}
                  accessibilityRole="text"
                  accessibilityLabel={`${badge.name}, ${badge.requirement}. ${earned ? "Earned" : "Not earned yet"}`}
                  style={[styles.badgeChip, earned && styles.badgeChipEarned]}
                >
                  <Text style={[styles.badgeIcon, !earned && styles.badgeIconLocked]}>{badge.icon}</Text>
                  <Text
                    style={[styles.badgeName, earned && styles.badgeNameEarned]}
                    numberOfLines={2}
                  >
                    {badge.name}
                  </Text>
                  <Text style={styles.badgeRequirement} numberOfLines={1}>
                    {badge.requirement}
                  </Text>
                </View>
              );
            })}
          </View>

          {upcomingBadge ? (
            <View style={styles.milestoneRow}>
              <View style={styles.milestoneTop}>
                <Text style={styles.milestoneLabel}>
                  Next up: {upcomingBadge.icon} {upcomingBadge.name}
                </Text>
                <Text style={styles.milestoneHint}>{upcomingBadge.requirement}</Text>
              </View>
              <View style={styles.milestoneTrack}>
                <View
                  style={[
                    styles.milestoneFill,
                    {
                      width: `${Math.min(100, Math.round((upcomingBadge.value / upcomingBadge.target) * 100))}%`,
                    },
                  ]}
                />
              </View>
            </View>
          ) : (
            <Text style={styles.milestoneHintEarned}>Every achievement earned. Genuinely impressive.</Text>
          )}
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
  const [hasLoadedTestState, setHasLoadedTestState] = useState(false);
  const [nutritionTotals, setNutritionTotals] = useState<NutritionTotals>({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
  });
  const [exerciseProgress, setExerciseProgress] = useState<Record<string, ExerciseProgress>>({});
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutHistoryEntry[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<EarnedBadges>({});
  const [limitationVerdicts, setLimitationVerdicts] = useState<LimitationVerdicts>({ note: "", verdicts: {} });
  const [dietPlan, setDietPlan] = useState<SavedDietPlan | null>(null);
  const [dailyCheckIn, setDailyCheckIn] = useState<DailyCheckIn | null>(null);
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
  const [activeWorkoutVetoedCount, setActiveWorkoutVetoedCount] = useState(0);
  const [workoutLoading, setWorkoutLoading] = useState(false);
  const [tooSoonWarningOpen, setTooSoonWarningOpen] = useState(false);

  const startWorkout = async () => {
    const hoursSince = hoursSinceLastWorkout(workoutHistory);
    if (hoursSince !== null && hoursSince < 8) {
      setTooSoonWarningOpen(true);
      return;
    }
    // Ask for today's check-in first, unless they already did one today.
    if (!todaysCheckIn(dailyCheckIn)) {
      setScreen("checkIn");
      return;
    }
    await beginWorkout();
  };

  // "Start anyway" from the trained-recently warning still routes through the
  // check-in -- that is exactly the case where readiness matters most.
  const proceedAfterTooSoonWarning = () => {
    setTooSoonWarningOpen(false);
    if (!todaysCheckIn(dailyCheckIn)) {
      setScreen("checkIn");
      return;
    }
    void beginWorkout();
  };

  const beginWorkout = async (checkInOverride?: DailyCheckIn | null) => {
    setTooSoonWarningOpen(false);
    setWorkoutLoading(true);
    const effectiveCheckIn = checkInOverride !== undefined ? checkInOverride : dailyCheckIn;
    const result = await createWorkoutFromCatalog(
      profile,
      exerciseProgress,
      workoutHistory,
      coachAdjustment,
      effectiveCheckIn,
    );
    // Resolve which list is actually being used before the veto runs, so the
    // built-in fallback roster is reviewed too -- not just catalog sessions.
    const builtExercises = result?.exercises ?? createWorkout(profile, exerciseProgress);

    const { exercises: vettedExercises, rejectedCount } = await vetAndRefill(
      builtExercises,
      profile,
      result,
      exerciseProgress,
      workoutHistory,
      limitationVerdicts,
      setLimitationVerdicts,
    );

    setActiveWorkoutExercises(vettedExercises);
    setActiveWorkoutVetoedCount(rejectedCount);
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
    dailyCheckIn,
    earnedBadges,
    limitationVerdicts,
  });
  stateRef.current = {
    profile,
    nutritionTotals,
    coachAdjustment,
    coachMessages,
    exerciseProgress,
    workoutHistory,
    dietPlan,
    dailyCheckIn,
    earnedBadges,
    limitationVerdicts,
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
            dailyCheckIn?: DailyCheckIn | null;
            earnedBadges?: EarnedBadges;
            limitationVerdicts?: LimitationVerdicts;
          };
          if (parsed.profile && Object.keys(parsed.profile).length > 0) {
            setProfile(parsed.profile);
            setNutritionTotals(parsed.nutritionTotals ?? { calories: 0, protein: 0, carbs: 0, fat: 0 });
            setCoachAdjustment(parsed.coachAdjustment ?? null);
            setCoachMessages(parsed.coachMessages ?? []);
            setExerciseProgress(parsed.exerciseProgress ?? {});
            setWorkoutHistory(parsed.workoutHistory ?? []);
            setDietPlan(parsed.dietPlan ?? null);
            setDailyCheckIn(parsed.dailyCheckIn ?? null);
            setEarnedBadges(parsed.earnedBadges ?? {});
            setLimitationVerdicts(parsed.limitationVerdicts ?? { note: "", verdicts: {} });
            setScreen("dashboard");
          }
        }
      } catch {
        window.localStorage.removeItem("project-g-test-state");
      }
    };

    const applySession = async (id: string, email: string | undefined) => {
      try {
        // Newer columns are selected separately: a column that hasn't been
        // migrated onto this Supabase project yet fails the WHOLE select,
        // which would strand every existing user on onboarding as if their
        // profile had been wiped. Losing one optional feature's data is
        // recoverable; losing the profile read is not.
        const CORE_COLUMNS =
          "profile, nutrition_totals, coach_adjustment, coach_messages, exercise_progress, workout_history, diet_plan, trial_started_at";
        const { data } = await supabase.from("user_data").select(CORE_COLUMNS).eq("user_id", id).maybeSingle();
        const { data: optionalData } = await supabase
          .from("user_data")
          .select("daily_check_in")
          .eq("user_id", id)
          .maybeSingle();
        // Selected on its own rather than alongside daily_check_in: if this
        // column hasn't been migrated onto the project yet, a combined select
        // would fail and take the check-in down with it.
        const { data: badgeData } = await supabase
          .from("user_data")
          .select("earned_badges")
          .eq("user_id", id)
          .maybeSingle();
        const { data: verdictData } = await supabase
          .from("user_data")
          .select("limitation_verdicts")
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
          setDailyCheckIn((optionalData?.daily_check_in as DailyCheckIn | null) ?? null);
          setEarnedBadges((badgeData?.earned_badges as EarnedBadges | null) ?? {});
          setLimitationVerdicts(
            (verdictData?.limitation_verdicts as LimitationVerdicts | null) ?? { note: "", verdicts: {} },
          );
          setScreen("dashboard");
        } else if (Object.keys(stateRef.current.profile).length > 0) {
          // Fresh account with no saved data yet: migrate whatever local/guest
          // progress already existed into it. Upsert (not update) so this still
          // works even if the on-signup trigger hasn't created the row yet.
          const migrateCore = {
            user_id: id,
            profile: stateRef.current.profile,
            nutrition_totals: stateRef.current.nutritionTotals,
            coach_adjustment: stateRef.current.coachAdjustment,
            coach_messages: stateRef.current.coachMessages,
            exercise_progress: stateRef.current.exerciseProgress,
            workout_history: stateRef.current.workoutHistory,
            diet_plan: stateRef.current.dietPlan,
          };
          const { error: migrateError } = await supabase.from("user_data").upsert({
            ...migrateCore,
            daily_check_in: stateRef.current.dailyCheckIn,
            earned_badges: stateRef.current.earnedBadges,
            limitation_verdicts: stateRef.current.limitationVerdicts,
          });
          if (migrateError?.code === "PGRST204") {
            const { error: retryError } = await supabase.from("user_data").upsert(migrateCore);
            if (retryError) console.error("Failed to migrate guest progress to account", retryError);
          } else if (migrateError) {
            console.error("Failed to migrate guest progress to account", migrateError);
          }
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
        dailyCheckIn,
        earnedBadges,
        limitationVerdicts,
      }),
    );
  }, [
    coachAdjustment,
    coachMessages,
    dailyCheckIn,
    dietPlan,
    earnedBadges,
    exerciseProgress,
    hasLoadedTestState,
    limitationVerdicts,
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
      const corePayload = {
        user_id: userId,
        profile,
        nutrition_totals: nutritionTotals,
        coach_adjustment: coachAdjustment,
        coach_messages: coachMessages,
        exercise_progress: exerciseProgress,
        workout_history: workoutHistory,
        diet_plan: dietPlan,
      };
      const { error } = await supabase
        .from("user_data")
        .upsert({
          ...corePayload,
          daily_check_in: dailyCheckIn,
          earned_badges: earnedBadges,
          limitation_verdicts: limitationVerdicts,
        });
      // PGRST204 = one of these columns isn't on this project yet. Retry with
      // just the core so profile/history still save; the check-in and earned
      // badges are the only things lost, and only until the migration in
      // supabase-setup.sql is applied.
      if (error?.code === "PGRST204") {
        const { error: retryError } = await supabase.from("user_data").upsert(corePayload);
        if (retryError) console.error("Failed to sync progress to account", retryError);
      } else if (error) {
        console.error("Failed to sync progress to account", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    coachAdjustment,
    coachMessages,
    dailyCheckIn,
    dietPlan,
    earnedBadges,
    exerciseProgress,
    hasLoadedTestState,
    limitationVerdicts,
    nutritionTotals,
    profile,
    userId,
    workoutHistory,
  ]);

  // Seal any badge whose condition is met right now, so it stays earned even
  // if the underlying numbers later move against it.
  useEffect(() => {
    if (!hasLoadedTestState) return;
    const badges = buildBadges(computeBadgeStats(workoutHistory, exerciseProgress, profile));
    const sealed = sealNewlyEarnedBadges(badges, earnedBadges);
    // null when nothing is new -- without that guard this effect would write
    // the state it depends on and re-run forever.
    if (sealed) setEarnedBadges(sealed);
  }, [earnedBadges, exerciseProgress, hasLoadedTestState, profile, workoutHistory]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUserId(null);
    setScreen("dashboard");
  };

  // Wipes the answers and all progress but keeps the account itself signed
  // in -- for testing a fresh onboarding/progression flow without having to
  // create a whole new account each time. The existing auto-save effect
  // below picks up every one of these state changes and pushes the cleared
  // state to Supabase on its own; nothing extra to upsert here.
  const handleResetProfile = () => {
    setProfile({});
    setExerciseProgress({});
    setWorkoutHistory([]);
    setEarnedBadges({});
    setLimitationVerdicts({ note: "", verdicts: {} });
    setCoachAdjustment(null);
    setCoachMessages([]);
    setDietPlan(null);
    setDailyCheckIn(null);
    setNutritionTotals({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    setActiveWorkoutExercises(null);
    setScreen("interview");
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
        <ScreenTransition screenKey={screen}>
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
              // `answers`, not `profile` -- setProfile above hasn't landed yet,
              // and this is the first session, where the limitation matters most.
              const built = result?.exercises ?? createWorkout(answers, exerciseProgress);
              const vetted = await vetAndRefill(
                built,
                answers,
                result,
                exerciseProgress,
                workoutHistory,
                limitationVerdicts,
                setLimitationVerdicts,
              );
              setActiveWorkoutExercises(vetted.exercises);
              setActiveWorkoutVetoedCount(vetted.rejectedCount);
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
            dailyCheckIn={dailyCheckIn}
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
            onResetProfile={handleResetProfile}
            trialDaysLeft={trialDaysRemaining(trialStartedAt)}
            trialEndsAtLabel={trialEndDateLabel(trialStartedAt)}
          />
        )}
        {screen === "checkIn" && (
          <CheckInScreen
            previousCheckIn={dailyCheckIn}
            onSkip={() => {
              // Deliberately does not record a check-in: skipping means "no
              // signal today", which leaves the plan untouched rather than
              // logging a neutral score that would look like a real answer.
              void beginWorkout(null);
            }}
            onSubmit={(next) => {
              setDailyCheckIn(next);
              void beginWorkout(next);
            }}
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
            vetoedCount={activeWorkoutVetoedCount}
            adjustment={coachAdjustment}
            checkIn={dailyCheckIn}
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
            exerciseProgress={exerciseProgress}
            earnedBadges={earnedBadges}
            onDashboard={() => setScreen("dashboard")}
            onStartWorkout={startWorkout}
            onOpenNutrition={() => setScreen("nutrition")}
            onOpenCoach={() => setScreen("coach")}
          />
        )}
        </ScreenTransition>
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
            <Pressable onPress={proceedAfterTooSoonWarning} style={styles.exerciseInfoDone}>
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
  screenTransition: { flex: 1 },
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
  // A ScrollView, so a long question -- the limitations list plus its
  // free-text field is the tallest -- scrolls under a fixed footer instead of
  // running behind the CONTINUE button.
  questionContent: { flex: 1 },
  questionContentInner: { paddingHorizontal: 24, paddingTop: 34, paddingBottom: 12 },
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
  // Locked rows read a shade quieter than editable ones, so the list shows at
  // a glance which answers are still yours to change.
  profileRowLabelLocked: { color: colors.muted },
  profileRowValueLocked: { color: "#5A6058" },
  profileRowLock: { color: "#5A6058", fontSize: 11 },
  profileLockedNote: {
    color: "#5A6058",
    fontSize: 10,
    fontWeight: "600",
    lineHeight: 14,
    marginTop: 10,
    paddingHorizontal: 4,
  },
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
  checkInGroup: {
    marginBottom: 4,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#212521",
  },
  checkInQuestionTitle: { color: colors.text, fontSize: 14, fontWeight: "700", marginBottom: 12 },
  checkInScaleRow: { flexDirection: "row", gap: 5 },
  checkInDot: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#262A24",
    backgroundColor: "#0C0E0C",
    alignItems: "center",
    justifyContent: "center",
  },
  checkInDotSelected: { borderColor: colors.lime, backgroundColor: "rgba(200,255,50,0.14)" },
  checkInDotText: { color: "#8A907F", fontSize: 11, fontWeight: "700" },
  checkInDotTextSelected: { color: colors.lime, fontWeight: "900" },
  checkInScaleLegend: { flexDirection: "row", justifyContent: "space-between", marginTop: 7 },
  checkInScaleLegendText: { color: "#5B6058", fontSize: 9, fontWeight: "600" },
  checkInSkipButton: { minHeight: 44, alignItems: "center", justifyContent: "center", marginTop: 6 },
  checkInSkipText: { color: colors.muted, fontSize: 10, fontWeight: "800", letterSpacing: 0.8 },
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
  limitationNoteInput: {
    marginTop: 12,
    minHeight: 84,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#262A24",
    backgroundColor: "#0C0E0C",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    textAlignVertical: "top",
  },
  dietPaceEstimate: { color: colors.lime, fontSize: 11, fontWeight: "700", lineHeight: 15, marginTop: 8 },
  dietAllergyNote: { color: "#5A6058", fontSize: 9, fontWeight: "600", lineHeight: 13, marginTop: 8 },
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
  // Amber rather than lime: this is an explanation for something missing, not
  // a feature of today's plan, and it shouldn't read as a reward.
  vetoBanner: {
    marginHorizontal: 16,
    marginBottom: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: 10,
    alignItems: "center",
    backgroundColor: "rgba(217,168,99,0.12)",
  },
  vetoBannerText: { color: "#D9A863", fontSize: 8, fontWeight: "900", letterSpacing: 0.8, textAlign: "center" },
  vetoBannerHint: {
    color: "#D9A863",
    fontSize: 9,
    fontWeight: "600",
    lineHeight: 13,
    textAlign: "center",
    marginTop: 4,
    opacity: 0.9,
  },
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
  cueCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    backgroundColor: "#0B0D0B",
  },
  cueCardBadge: { color: "#5A6058", fontSize: 8, fontWeight: "900", letterSpacing: 1.4, marginBottom: 14 },
  // Takes the space the badge would have had, plus enough height for the figure
  // to be legible without pushing the name and cue off the card.
  // Tall enough for the figure to read, short enough that the name, target and
  // written cue all still fit on the card underneath it.
  // Raised twice now: at 120px a figure is legible as a shape but not as a
  // body, and the 3D mannequin earns more room than the flat one did.
  // The demo fills the whole stage width -- boxing it into a centered square
  // wasted half the screen on anything wider than a phone.
  cueCardFigure: { alignSelf: "stretch", flex: 1, minHeight: 220, marginBottom: 8 },
  pose3dHost: { ...StyleSheet.absoluteFillObject },
  // Top-right corner: visible immediately, balances the "01" top-left, and
  // never covers the figure -- centered under it, it sat over the feet and
  // the lying movements.
  poseExpandHint: {
    position: "absolute",
    top: 10,
    right: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(10, 13, 9, 0.78)",
    borderWidth: 1,
    borderColor: "rgba(200, 255, 50, 0.45)",
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  poseExpandHintIcon: { color: colors.lime, fontSize: 13, fontWeight: "800", lineHeight: 14 },
  poseExpandHintText: { color: colors.text, fontSize: 10, fontWeight: "800", letterSpacing: 1.6 },
  poseModalBackdrop: { flex: 1, backgroundColor: "#0B0D0B" },
  poseModalStage: { ...StyleSheet.absoluteFillObject },
  poseModalHeader: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: 20,
  },
  poseModalTitles: { flex: 1, marginRight: 12 },
  poseModalName: { color: "#F2F5F1", fontSize: 20, fontWeight: "800" },
  poseModalHint: { color: "#6E7A74", fontSize: 11, fontWeight: "700", letterSpacing: 1, marginTop: 4 },
  poseModalClose: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#1A1F1C",
    alignItems: "center",
    justifyContent: "center",
  },
  poseModalCloseText: { color: "#F2F5F1", fontSize: 18, fontWeight: "700" },
  cueCardName: { color: colors.text, fontSize: 22, fontWeight: "900", textAlign: "center" },
  cueCardTarget: { color: colors.lime, fontSize: 10, fontWeight: "800", letterSpacing: 0.8, marginTop: 6, textTransform: "uppercase" },
  cueCardText: { color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: "center", marginTop: 14 },
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
  // Sits ON the demo canvas (zIndex above it), small and translucent -- a
  // corner label, not a column of its own.
  exerciseNumber: {
    position: "absolute",
    left: 14,
    top: 8,
    color: "rgba(224, 255, 130, 0.30)",
    fontSize: 36,
    lineHeight: 40,
    fontWeight: "900",
    zIndex: 2,
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
  // alignItems "stretch", not "center": centering sized the cue card -- and
  // the demo canvas inside it -- to the WIDTH OF THE TEXT under the figure,
  // so a short catalog name like "Barbell Squat" produced a 145px-wide stage
  // while a long local cue produced a wide one.
  demoStage: { width: "100%", height: "100%", alignItems: "stretch", justifyContent: "center" },
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
  // Equipment is drawn in a cooler grey than the figure so it reads as the
  // thing being held rather than part of the body.
  poseBar: {
    position: "absolute",
    height: 4,
    marginTop: -2,
    borderRadius: 2,
    backgroundColor: "#9AA3A0",
  },
  posePlate: {
    position: "absolute",
    width: 12,
    height: 12,
    marginLeft: -6,
    marginTop: -6,
    borderRadius: 6,
    backgroundColor: "#C6CFCB",
  },
  poseBell: { position: "absolute", backgroundColor: "#C6CFCB" },
  // Dim: it is a reference for which way is down, not part of the movement.
  // Lighter than the #39413D it was authored at, which was chosen against a
  // card it was never actually drawn on and is close to invisible there.
  poseFloor: { position: "absolute", left: 0, right: 0, height: 1, backgroundColor: "#4A544E" },
  // Light enough to read against the card, dark enough to stay behind the
  // figure. #3A423E was invisible on #0B0D0B.
  poseSlab: { position: "absolute", borderRadius: 3, backgroundColor: "#6E7A74" },
  // The trunk is heavier than the limbs and the far side is dimmer, which is
  // what gives a side view any depth at all.
  poseLineCore: {
    position: "absolute",
    height: 5,
    marginTop: -2.5,
    borderRadius: 3,
    backgroundColor: "#63FF77",
    shadowColor: "#63FF77",
    shadowOpacity: 0.9,
    shadowRadius: 4,
  },
  poseLineFar: {
    position: "absolute",
    height: 3,
    marginTop: -1.5,
    borderRadius: 2,
    backgroundColor: "#2F7A3C",
  },
  poseHead: {
    position: "absolute",
    borderWidth: 3,
    borderColor: "#63FF77",
    backgroundColor: "transparent",
  },
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

  // The showpiece of the screen -- lime on near-black so the number is the
  // first thing the eye lands on when Progress opens.
  volumeCard: {
    borderRadius: 18,
    marginTop: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: "rgba(200,255,50,0.35)",
    backgroundColor: "rgba(200,255,50,0.07)",
  },
  volumeCardLabel: { color: colors.lime, fontSize: 8, fontWeight: "900", letterSpacing: 1.4 },
  volumeCardValue: { color: colors.text, fontSize: 34, fontWeight: "900", marginTop: 6 },
  volumeCardUnit: { color: colors.muted, fontSize: 16, fontWeight: "800" },
  volumeCardCompare: { color: colors.muted, fontSize: 11, fontWeight: "600", marginTop: 4 },
  volumeCardStats: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "rgba(200,255,50,0.18)",
  },
  volumeCardStat: { flex: 1, minWidth: 0 },
  volumeCardStatDivider: { width: 1, alignSelf: "stretch", backgroundColor: "rgba(200,255,50,0.18)", marginHorizontal: 12 },
  volumeCardStatValue: { color: colors.lime, fontSize: 20, fontWeight: "900" },
  volumeCardStatLabel: { color: colors.muted, fontSize: 7, fontWeight: "900", letterSpacing: 0.8, marginTop: 3 },
  volumeCardFootnote: { color: "#5A6058", fontSize: 8, fontWeight: "600", lineHeight: 12, marginTop: 10 },

  consistencyRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 },
  consistencyValue: { color: colors.text, fontSize: 20, fontWeight: "900" },
  consistencyTarget: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  consistencyHint: { color: colors.muted, fontSize: 10, fontWeight: "600", flexShrink: 1, textAlign: "right" },
  consistencyTrack: { height: 6, borderRadius: 3, backgroundColor: "#1B1E1A", marginTop: 10, overflow: "hidden" },
  consistencyFill: { height: "100%", borderRadius: 3, backgroundColor: colors.lime },

  volumeChart: { flexDirection: "row", alignItems: "flex-end", gap: 6, marginTop: 4 },
  volumeChartColumn: { flex: 1, alignItems: "center" },
  // Explicit height, not flex: 1 -- the bars size themselves as a percentage
  // of this, and a percentage can only resolve against a definite height.
  volumeChartBarTrack: { height: 72, width: "100%", justifyContent: "flex-end" },
  volumeChartBar: { width: "100%", borderRadius: 4, backgroundColor: colors.lime, minHeight: 2 },
  volumeChartBarEmpty: { backgroundColor: "#2C312B" },
  volumeChartLabel: { color: colors.muted, fontSize: 6, fontWeight: "700", marginTop: 6 },
  volumeChartCaption: { color: colors.muted, fontSize: 9, fontWeight: "600", marginTop: 10 },

  liftRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#1B1E1A",
  },
  liftCopy: { flexShrink: 1, minWidth: 0 },
  liftName: { color: colors.text, fontSize: 12, fontWeight: "600" },
  liftLevel: { color: colors.muted, fontSize: 9, fontWeight: "700", letterSpacing: 0.4, marginTop: 2 },
  liftLevelNote: { color: "#5A6058", fontSize: 9, fontWeight: "600", lineHeight: 13, marginTop: 10 },
  liftRight: { flexDirection: "row", alignItems: "baseline", gap: 8, flexShrink: 0 },
  liftWeight: { color: colors.text, fontSize: 13, fontWeight: "900" },
  liftGain: { color: colors.lime, fontSize: 10, fontWeight: "800" },
  liftGainNeutral: { color: colors.muted, fontSize: 10, fontWeight: "700" },

  badgeHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  badgeCount: { color: colors.lime, fontSize: 11, fontWeight: "900", marginBottom: 8 },
  badgeGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  // Three per row at phone width, and the basis leaves room for two 8px gaps.
  badgeChip: {
    flexBasis: "31%",
    flexGrow: 1,
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#242824",
    backgroundColor: "#0C0E0C",
    opacity: 0.45,
  },
  badgeChipEarned: { opacity: 1, borderColor: "rgba(200,255,50,0.4)", backgroundColor: "rgba(200,255,50,0.06)" },
  badgeIcon: { fontSize: 20 },
  // Locked icons read as silhouettes rather than full-colour emoji, so an
  // earned grid is obvious at a glance instead of needing to be read.
  badgeIconLocked: { opacity: 0.5 },
  badgeName: { color: colors.muted, fontSize: 9, fontWeight: "800", textAlign: "center", marginTop: 5 },
  badgeNameEarned: { color: colors.text },
  badgeRequirement: { color: "#5A6058", fontSize: 7, fontWeight: "600", textAlign: "center", marginTop: 2 },

  milestoneRow: { marginTop: 10 },
  milestoneTop: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: 10 },
  milestoneLabel: { color: colors.text, fontSize: 12, fontWeight: "700" },
  milestoneHint: { color: colors.muted, fontSize: 10, fontWeight: "700" },
  milestoneHintEarned: { color: colors.lime },
  milestoneTrack: { height: 5, borderRadius: 3, backgroundColor: "#1B1E1A", marginTop: 6, overflow: "hidden" },
  milestoneFill: { height: "100%", borderRadius: 3, backgroundColor: colors.lime },

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
