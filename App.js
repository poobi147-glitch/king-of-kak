import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  Vibration,
  View,
} from 'react-native';

const QUIZ_SECONDS = 5;
const QUIZ_MS = QUIZ_SECONDS * 1000;
const STORAGE_KEY = 'futureOxNickname';
const TIERS = [
  { name: 'CHALLENGER', min: 17000, color: '#E7FFF7', accent: '#39FF88' },
  { name: 'GRANDMASTER', min: 14500, color: '#FFE7EF', accent: '#FF2E63' },
  { name: 'MASTER', min: 12000, color: '#EFE7FF', accent: '#8A5CFF' },
  { name: 'PLATINUM', min: 9500, color: '#E5FFF9', accent: '#2CD7C8' },
  { name: 'GOLD', min: 7000, color: '#FFF4C7', accent: '#F4B000' },
  { name: 'SILVER', min: 4500, color: '#F0F2F4', accent: '#9BA3AA' },
  { name: 'BRONZE', min: 2200, color: '#FFE1C8', accent: '#B86B2B' },
  { name: 'IRON', min: 0, color: '#E6E8E7', accent: '#5C6460' },
];

const SUBJECT_QUESTIONS = {
  민법: [
    {
      text: '민법상 권리능력은 출생한 때부터 인정된다.',
      answer: true,
      note: '사람은 생존한 동안 권리와 의무의 주체가 됩니다.',
    },
    {
      text: '채무불이행으로 인한 손해배상청구권은 원칙적으로 채무자의 귀책사유를 요구한다.',
      answer: true,
      note: '이행지체, 이행불능 등에서 귀책사유가 핵심입니다.',
    },
    {
      text: '민사소송에서 처분권주의는 법원이 당사자의 신청 범위를 넘을 수 있게 한다.',
      answer: false,
      note: '법원은 당사자의 신청 범위 안에서 판단합니다.',
    },
    {
      text: '소멸시효의 이익은 당사자가 미리 포기할 수 있다.',
      answer: false,
      note: '소멸시효 완성 전 포기는 허용되지 않습니다.',
    },
    {
      text: '착오로 인한 의사표시는 법률행위 내용의 중요부분에 착오가 있는 때 취소할 수 있다.',
      answer: true,
      note: '중요부분 착오와 중대한 과실 여부가 쟁점입니다.',
    },
  ],
  형법: [
    {
      text: '형사소송에서 피고인의 자백만으로 유죄를 인정할 수 있다.',
      answer: false,
      note: '자백에는 보강증거가 필요합니다.',
    },
    {
      text: '정당방위는 현재의 부당한 침해에 대한 상당한 이유 있는 행위여야 한다.',
      answer: true,
      note: '현재성, 부당성, 상당성이 중요합니다.',
    },
    {
      text: '부작위범은 법률상 작위의무가 없어도 언제나 성립한다.',
      answer: false,
      note: '보증인 지위와 작위의무가 문제됩니다.',
    },
    {
      text: '미수범은 법률에 특별한 규정이 있는 때에 처벌한다.',
      answer: true,
      note: '미수범 처벌에는 개별 규정이 필요합니다.',
    },
    {
      text: '고의가 없으면 과실범 처벌 규정이 없어도 항상 처벌된다.',
      answer: false,
      note: '과실범은 법률에 특별한 규정이 있는 때에만 처벌합니다.',
    },
  ],
  공법: [
    {
      text: '헌법재판소의 위헌결정은 원칙적으로 장래효만 가진다.',
      answer: false,
      note: '형벌 법규 등 예외적으로 소급효가 인정되는 영역이 있습니다.',
    },
    {
      text: '행정행위의 하자가 중대하고 명백하면 무효가 될 수 있다.',
      answer: true,
      note: '중대명백설은 행정법의 대표 판단 기준입니다.',
    },
    {
      text: '헌법상 명확성 원칙은 죄형법정주의와 관련된다.',
      answer: true,
      note: '무엇이 금지되는지 예측 가능해야 합니다.',
    },
    {
      text: '법률유보원칙은 기본권 제한에서 중요한 통제 원리다.',
      answer: true,
      note: '국가작용에는 법적 근거가 요구됩니다.',
    },
    {
      text: '행정심판은 모든 행정소송의 필수 전치절차다.',
      answer: false,
      note: '개별 법률이 정한 경우에만 필수 전치가 됩니다.',
    },
  ],
};
const QUESTIONS = Object.values(SUBJECT_QUESTIONS).flat();
const MARATHON_COUNT = 30;

export default function App() {
  const [screen, setScreen] = useState('start');
  const [nickname, setNickname] = useState('');
  const [quizDeck, setQuizDeck] = useState(QUESTIONS);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selected, setSelected] = useState(null);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [remainingMs, setRemainingMs] = useState(QUIZ_MS);
  const [reactionLog, setReactionLog] = useState([]);
  const [feedback, setFeedback] = useState('');
  const [isFinished, setIsFinished] = useState(false);

  const scorePop = useRef(new Animated.Value(0)).current;
  const glitch = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0)).current;
  const startTime = useRef(Date.now());
  const timeoutRef = useRef(null);

  const currentQuestion = quizDeck[questionIndex];
  const progress = useMemo(
    () => ((questionIndex + 1) / quizDeck.length) * 100,
    [questionIndex, quizDeck.length],
  );
  const tier = getTier(score);
  const missedQuestions = reactionLog.filter((item) => !item.correct);
  const correctCount = reactionLog.filter((item) => item.correct).length;
  const feedbackIsWrong = feedback.startsWith('오답') || feedback.startsWith('시간초과');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((storedName) => {
      if (storedName) {
        setNickname(storedName);
      }
    });
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 900,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 900,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [pulse]);

  useEffect(() => {
    if (screen !== 'quiz' || selected !== null || isFinished) {
      return undefined;
    }

    setRemainingMs(QUIZ_MS);
    startTime.current = Date.now();

    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime.current;
      const nextRemaining = Math.max(0, QUIZ_MS - elapsed);
      setRemainingMs(nextRemaining);

      if (nextRemaining <= 0) {
          clearInterval(interval);
          handleAnswer(null);
      }
    }, 33);

    return () => clearInterval(interval);
  }, [questionIndex, screen, selected, isFinished]);

  const resetRun = async (deck) => {
    const cleanName = nickname.trim() || 'NEON-ROOKIE';
    await AsyncStorage.setItem(STORAGE_KEY, cleanName);
    setNickname(cleanName);
    setQuizDeck(deck);
    setQuestionIndex(0);
    setSelected(null);
    setScore(0);
    setCombo(0);
    setBestCombo(0);
    setReactionLog([]);
    setRemainingMs(QUIZ_MS);
    setFeedback('');
    setIsFinished(false);
    setScreen('quiz');
  };

  const startGame = () => {
    resetRun(QUESTIONS);
  };

  const openMarathonSelect = () => {
    setScreen('subjectSelect');
  };

  const startMarathon = (subject) => {
    const subjectDeck = SUBJECT_QUESTIONS[subject];
    const marathonDeck = Array.from({ length: MARATHON_COUNT }, (_, index) => ({
      ...subjectDeck[index % subjectDeck.length],
      subject,
    }));
    resetRun(marathonDeck);
  };

  const handleAnswer = (choice) => {
    if (selected !== null || isFinished) {
      return;
    }

    const isCorrect = choice === currentQuestion.answer;
    const reactionMs = Math.min(Date.now() - startTime.current, QUIZ_MS);
    const remainingRatio = Math.max(0, (QUIZ_MS - reactionMs) / QUIZ_MS);
    const speedBonus = Math.round(Math.pow(remainingRatio, 2) * 1700);
    const nextCombo = isCorrect ? combo + 1 : 0;
    const comboBonus = isCorrect ? nextCombo * 180 : 0;
    const earned = isCorrect ? 300 + speedBonus + comboBonus : 0;

    setSelected(choice);
    setRemainingMs(Math.max(0, QUIZ_MS - reactionMs));
    setReactionLog((items) => [
      ...items,
      {
        answer: currentQuestion.answer,
        choice,
        correct: isCorrect,
        earned,
        note: currentQuestion.note,
        question: questionIndex + 1,
        reactionMs,
        text: currentQuestion.text,
      },
    ]);
    setFeedback(
      isCorrect
        ? `정답 +${earned} / ${formatSeconds(reactionMs)} / COMBO x${nextCombo}`
        : choice === null
          ? `시간초과 / 정답 ${currentQuestion.answer ? 'O' : 'X'}`
          : `오답 / 정답 ${currentQuestion.answer ? 'O' : 'X'} / ${formatSeconds(reactionMs)}`,
    );

    if (isCorrect) {
      Vibration.vibrate(45);
      setScore((value) => value + earned);
      setCombo(nextCombo);
      setBestCombo((value) => Math.max(value, nextCombo));
      scorePop.setValue(0);
      Animated.spring(scorePop, {
        toValue: 1,
        friction: 4,
        tension: 180,
        useNativeDriver: true,
      }).start();
    } else {
      Vibration.vibrate([0, 35, 45, 35]);
      setCombo(0);
      glitch.setValue(0);
      Animated.sequence([
        Animated.timing(glitch, { toValue: 1, duration: 70, useNativeDriver: true }),
        Animated.timing(glitch, { toValue: -1, duration: 70, useNativeDriver: true }),
        Animated.timing(glitch, { toValue: 0.75, duration: 70, useNativeDriver: true }),
        Animated.timing(glitch, { toValue: 0, duration: 100, useNativeDriver: true }),
      ]).start();
    }

    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (questionIndex === quizDeck.length - 1) {
        setIsFinished(true);
        setFeedback('오늘의 재판이 종료되었습니다');
        return;
      }
      setQuestionIndex((value) => value + 1);
      setSelected(null);
      setFeedback('');
    }, 1050);
  };

  const screenShake = glitch.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-10, 0, 10],
  });

  const scoreScale = scorePop.interpolate({
    inputRange: [0, 0.55, 1],
    outputRange: [1, 1.24, 1],
  });

  const judgeScale = pulse.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.04],
  });

  const timerTone = remainingMs <= 2000 ? styles.timerDanger : styles.timerSafe;

  if (screen === 'start') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.startShell}
        >
          <View style={styles.topRail}>
            <Text style={styles.railText}>OX RUSH ARENA</Text>
            <Text style={styles.railText}>RANKED MODE</Text>
          </View>

          <Animated.View style={{ transform: [{ scale: judgeScale }] }}>
            <DumbMascot />
          </Animated.View>

          <View style={styles.heroCopy}>
            <Text style={styles.kicker}>K-bar exam OX battle</Text>
            <Text style={styles.title}>OX RUSH</Text>
          </View>

          <View style={styles.nicknamePanel}>
            <Text style={styles.inputLabel}>닉네임</Text>
            <TextInput
              autoCapitalize="characters"
              maxLength={16}
              onChangeText={setNickname}
              placeholder="NEON-ROOKIE"
              placeholderTextColor="#9AA19B"
              selectionColor="#39FF88"
              style={styles.input}
              value={nickname}
            />
          </View>

          <View style={styles.modeGrid}>
            <Pressable
              style={({ pressed }) => [styles.rankButton, pressed && styles.pressed]}
              onPress={startGame}
            >
              <Text style={styles.rankButtonText}>랭크게임</Text>
            </Pressable>
            <View style={styles.subModeRow}>
              <Pressable style={({ pressed }) => [styles.modeButton, pressed && styles.pressed]} onPress={openMarathonSelect}>
                <Text style={styles.modeButtonText}>무작위총력전</Text>
              </Pressable>
              <Pressable style={({ pressed }) => [styles.modeButton, pressed && styles.pressed]} onPress={() => setScreen('review')}>
                <Text style={styles.modeButtonText}>속죄의시간</Text>
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  if (screen === 'subjectSelect') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.subjectShell}>
          <Text style={styles.subjectTitle}>무작위총력전</Text>
          <Text style={styles.subjectSubtitle}>과목 고르고 30문제. 지문에는 장난 안 침.</Text>
          <View style={styles.subjectGrid}>
            {Object.keys(SUBJECT_QUESTIONS).map((subject) => (
              <Pressable
                key={subject}
                style={({ pressed }) => [styles.subjectButton, pressed && styles.pressed]}
                onPress={() => startMarathon(subject)}
              >
                <Text style={styles.subjectButtonText}>{subject}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
            onPress={() => setScreen('start')}
          >
            <Text style={styles.secondaryButtonText}>뒤로</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  if (screen === 'review') {
    return (
      <SafeAreaView style={styles.safeArea}>
        <StatusBar style="dark" />
        <View style={styles.reviewShell}>
          <Text style={styles.reviewTitle}>속죄의시간</Text>
          <Text style={styles.reviewSubtitle}>틀린 판결만 모았습니다.</Text>
          <ScrollView contentContainerStyle={styles.reviewList}>
            {missedQuestions.length ? (
              missedQuestions.map((item) => (
                <View key={item.question} style={styles.reviewCard}>
                  <Text style={styles.reviewCase}>Q{String(item.question).padStart(2, '0')}</Text>
                  <Text style={styles.reviewQuestion}>{item.text}</Text>
                  <Text style={styles.reviewAnswer}>
                    정답 {item.answer ? 'O' : 'X'} / 내 손가락{' '}
                    {item.choice === null ? '무응답' : item.choice ? 'O' : 'X'}
                  </Text>
                  <Text style={styles.reviewNote}>{item.note}</Text>
                </View>
              ))
            ) : (
              <View style={styles.reviewCard}>
                <Text style={styles.reviewCase}>EMPTY</Text>
                <Text style={styles.reviewQuestion}>아직 복습할 문제가 없습니다.</Text>
              </View>
            )}
          </ScrollView>
          <Pressable style={({ pressed }) => [styles.startButton, pressed && styles.pressed]} onPress={startGame}>
            <Text style={styles.startButtonText}>다시 재판장 입장</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <Animated.View style={[styles.quizShell, { transform: [{ translateX: screenShake }] }]}>
        {!isFinished && (
          <>
            <View style={styles.quizHeader}>
              <View>
                <Text style={styles.headerMeta}>닉네임</Text>
                <Text style={styles.headerValue}>{nickname}</Text>
                <Text style={styles.tierValue}>{tier.name}</Text>
              </View>
              <Animated.View style={[styles.scoreBox, { transform: [{ scale: scoreScale }] }]}>
                <Text style={styles.headerMeta}>SCORE</Text>
                <Text style={styles.scoreValue}>{score}</Text>
              </Animated.View>
            </View>

            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>

            <View style={styles.statusGrid}>
              <View style={styles.statusCell}>
                <Text style={styles.headerMeta}>CASE</Text>
                <Text style={styles.statusValue}>
                  Q{String(questionIndex + 1).padStart(2, '0')}
                </Text>
              </View>
              <View style={[styles.statusCell, styles.comboCell]}>
                <Text style={styles.headerMeta}>COMBO</Text>
                <Text style={styles.statusValue}>x{combo}</Text>
              </View>
              <View style={styles.statusCell}>
                <Text style={styles.headerMeta}>TIME</Text>
                <Text style={[styles.statusValue, timerTone]}>{formatSeconds(remainingMs)}</Text>
              </View>
            </View>
          </>
        )}

        <View style={styles.questionCard}>
          <View style={styles.cardNoiseRow}>
            <View style={styles.pixel} />
            <View style={styles.pixel} />
            <View style={styles.pixelWide} />
          </View>
          <Text style={styles.questionTag}>
            RANKED OX
          </Text>
          <Text style={styles.questionText}>
            {isFinished ? '오늘의 재판이 종료되었습니다' : currentQuestion.text}
          </Text>
          {isFinished ? (
            <RankResult correctCount={correctCount} score={score} tier={tier} totalCount={quizDeck.length} />
          ) : (
            <Text style={[styles.feedbackText, feedbackIsWrong && styles.feedbackWrong]}>
              {feedback || ''}
            </Text>
          )}
        </View>

        {!isFinished ? (
          <View style={styles.answerRow}>
            <AnswerButton
              disabled={selected !== null}
              isActive={selected === true}
              label="O"
              onPress={() => handleAnswer(true)}
              tone="positive"
            />
            <AnswerButton
              disabled={selected !== null}
              isActive={selected === false}
              label="X"
              onPress={() => handleAnswer(false)}
              tone="negative"
            />
          </View>
        ) : (
          <View style={styles.endActions}>
            <Pressable
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
              onPress={() => setScreen('review')}
            >
              <Text style={styles.secondaryButtonText}>속죄의시간</Text>
            </Pressable>
            <Pressable style={({ pressed }) => [styles.startButton, pressed && styles.pressed]} onPress={startGame}>
              <Text style={styles.startButtonText}>RETRY</Text>
            </Pressable>
          </View>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

function DumbMascot() {
  return (
    <View style={styles.mascotWrap}>
      <View style={styles.mascotHalo} />
      <View style={styles.signRow}>
        <View style={styles.signStick} />
        <View style={[styles.signBoard, styles.signO]}>
          <Text style={styles.signText}>O</Text>
        </View>
        <View style={styles.signGap} />
        <View style={[styles.signBoard, styles.signX]}>
          <Text style={styles.signText}>X</Text>
        </View>
        <View style={styles.signStick} />
      </View>
      <View style={styles.mascotHead}>
        <View style={styles.mascotEyes}>
          <View style={styles.mascotEye} />
          <View style={styles.mascotEyeSmall} />
        </View>
        <View style={styles.mascotMouth} />
      </View>
      <View style={styles.mascotBody}>
        <Text style={styles.mascotText}>?</Text>
      </View>
    </View>
  );
}

function RankResult({ correctCount, score, tier, totalCount }) {
  return (
    <View style={styles.rankResult}>
      <Text style={styles.rankName}>{toTitleCase(tier.name)}</Text>
      <Text style={styles.rankStat}>정답 {correctCount}/{totalCount}</Text>
      <Text style={styles.rankStat}>Score {score}</Text>
    </View>
  );
}

function AnswerButton({ disabled, isActive, label, onPress, tone }) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.answerButton,
        tone === 'positive' ? styles.answerO : styles.answerX,
        isActive && styles.answerActive,
        pressed && styles.pressed,
        disabled && !isActive && styles.answerDisabled,
      ]}
    >
      <Text style={styles.answerLabel}>{label}</Text>
      <Text style={styles.answerCaption}>{tone === 'positive' ? 'TRUE' : 'FALSE'}</Text>
    </Pressable>
  );
}

function formatSeconds(ms) {
  return `${(ms / 1000).toFixed(3)}s`;
}

function getTier(score) {
  return TIERS.find((tier) => score >= tier.min) ?? TIERS[TIERS.length - 1];
}

function toTitleCase(value) {
  return value
    .toLowerCase()
    .split(' ')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F7F7F1',
  },
  startShell: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 22,
    paddingVertical: 18,
  },
  topRail: {
    borderColor: '#171B18',
    borderWidth: 2,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  railText: {
    color: '#171B18',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 0,
  },
  mascotWrap: {
    alignItems: 'center',
    alignSelf: 'center',
    height: 218,
    justifyContent: 'center',
    marginTop: 8,
    width: 238,
  },
  mascotHalo: {
    backgroundColor: 'transparent',
    borderColor: '#171B18',
    borderWidth: 0,
    height: 146,
    position: 'absolute',
    transform: [{ rotate: '6deg' }],
    width: 188,
  },
  signRow: {
    alignItems: 'center',
    flexDirection: 'row',
    position: 'absolute',
    top: 36,
    zIndex: 3,
  },
  signBoard: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#171B18',
    borderWidth: 3,
    height: 52,
    justifyContent: 'center',
    shadowColor: '#171B18',
    shadowOffset: { height: 3, width: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    width: 52,
  },
  signO: {
    backgroundColor: '#FFFFFF',
    transform: [{ rotate: '-12deg' }],
  },
  signX: {
    transform: [{ rotate: '12deg' }],
  },
  signText: {
    color: '#171B18',
    fontSize: 31,
    fontWeight: '900',
  },
  signStick: {
    backgroundColor: '#171B18',
    height: 78,
    marginHorizontal: -2,
    marginTop: 30,
    width: 6,
  },
  signGap: {
    width: 72,
  },
  mascotHead: {
    alignItems: 'center',
    backgroundColor: '#F7F7F1',
    borderColor: '#171B18',
    borderWidth: 4,
    height: 78,
    justifyContent: 'center',
    marginTop: 26,
    transform: [{ rotate: '-3deg' }],
    width: 94,
  },
  mascotEyes: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 20,
  },
  mascotEye: {
    backgroundColor: '#171B18',
    height: 18,
    width: 18,
  },
  mascotEyeSmall: {
    backgroundColor: '#171B18',
    height: 10,
    marginTop: 8,
    width: 10,
  },
  mascotMouth: {
    backgroundColor: '#FFFFFF',
    borderColor: '#171B18',
    borderWidth: 2,
    height: 16,
    marginTop: 10,
    transform: [{ rotate: '8deg' }],
    width: 42,
  },
  mascotBody: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#171B18',
    borderWidth: 4,
    height: 58,
    justifyContent: 'center',
    transform: [{ rotate: '4deg' }],
    width: 74,
  },
  mascotText: {
    color: '#171B18',
    fontSize: 30,
    fontWeight: '900',
  },
  judgeWrap: {
    alignItems: 'center',
    alignSelf: 'center',
    height: 210,
    justifyContent: 'center',
    marginTop: 12,
    width: 210,
  },
  halo: {
    backgroundColor: '#39FF88',
    borderColor: '#171B18',
    borderWidth: 2,
    height: 168,
    position: 'absolute',
    transform: [{ rotate: '8deg' }],
    width: 168,
  },
  judgeHead: {
    alignItems: 'center',
    backgroundColor: '#F7F7F1',
    borderColor: '#171B18',
    borderWidth: 4,
    height: 104,
    justifyContent: 'center',
    width: 132,
  },
  visor: {
    alignItems: 'center',
    backgroundColor: '#171B18',
    flexDirection: 'row',
    gap: 20,
    height: 38,
    justifyContent: 'center',
    width: 92,
  },
  eye: {
    backgroundColor: '#39FF88',
    height: 14,
    width: 14,
  },
  judgeMouth: {
    backgroundColor: '#171B18',
    height: 8,
    marginTop: 14,
    width: 44,
  },
  judgeBody: {
    alignItems: 'center',
    backgroundColor: '#171B18',
    height: 46,
    justifyContent: 'center',
    width: 156,
  },
  judgeLabel: {
    color: '#39FF88',
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 0,
  },
  heroCopy: {
    gap: 8,
  },
  kicker: {
    color: '#171B18',
    fontSize: 13,
    fontWeight: '900',
    letterSpacing: 0,
  },
  title: {
    color: '#171B18',
    fontSize: 54,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 58,
  },
  subtitle: {
    color: '#4A514C',
    fontSize: 16,
    fontWeight: '900',
    lineHeight: 24,
  },
  nicknamePanel: {
    borderColor: '#171B18',
    borderWidth: 2,
    padding: 14,
  },
  inputLabel: {
    color: '#189B54',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#171B18',
    borderWidth: 2,
    color: '#171B18',
    fontSize: 20,
    fontWeight: '900',
    height: 54,
    paddingHorizontal: 12,
  },
  modeGrid: {
    gap: 10,
  },
  rankButton: {
    alignItems: 'center',
    backgroundColor: '#171B18',
    borderColor: '#171B18',
    borderWidth: 3,
    justifyContent: 'center',
    minHeight: 68,
    shadowColor: '#171B18',
    shadowOffset: { height: 4, width: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  rankButtonText: {
    color: '#FFFFFF',
    fontSize: 21,
    fontWeight: '900',
  },
  subModeRow: {
    flexDirection: 'row',
    gap: 8,
  },
  modeButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#171B18',
    borderWidth: 3,
    flex: 1,
    justifyContent: 'center',
    minHeight: 62,
    paddingHorizontal: 4,
    shadowColor: '#171B18',
    shadowOffset: { height: 4, width: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  modeButtonText: {
    color: '#171B18',
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
  startButton: {
    alignItems: 'center',
    backgroundColor: '#39FF88',
    borderColor: '#171B18',
    borderWidth: 3,
    justifyContent: 'center',
    minHeight: 62,
    shadowColor: '#171B18',
    shadowOffset: { height: 6, width: 6 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  startButtonText: {
    color: '#171B18',
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: 0,
  },
  pressed: {
    opacity: 0.72,
    transform: [{ translateX: 2 }, { translateY: 2 }],
  },
  quizShell: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  quizHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  headerMeta: {
    color: '#5F6962',
    fontSize: 11,
    fontWeight: '900',
  },
  headerValue: {
    color: '#171B18',
    fontSize: 19,
    fontWeight: '900',
    marginTop: 3,
  },
  tierValue: {
    backgroundColor: '#39FF88',
    color: '#171B18',
    fontSize: 10,
    fontWeight: '900',
    marginTop: 5,
    paddingHorizontal: 7,
    paddingVertical: 3,
    textAlign: 'center',
  },
  scoreBox: {
    alignItems: 'flex-end',
    backgroundColor: '#171B18',
    borderColor: '#39FF88',
    borderWidth: 2,
    minWidth: 126,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  scoreValue: {
    color: '#39FF88',
    fontSize: 24,
    fontWeight: '900',
  },
  progressTrack: {
    backgroundColor: '#D9DED8',
    borderColor: '#171B18',
    borderWidth: 2,
    height: 18,
    marginTop: 18,
  },
  progressFill: {
    backgroundColor: '#39FF88',
    height: '100%',
  },
  statusGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  statusCell: {
    backgroundColor: '#FFFFFF',
    borderColor: '#171B18',
    borderWidth: 2,
    flex: 1,
    padding: 12,
  },
  comboCell: {
    backgroundColor: '#E9FFE9',
  },
  statusValue: {
    color: '#171B18',
    fontSize: 22,
    fontWeight: '900',
    marginTop: 4,
  },
  timerSafe: {
    color: '#189B54',
  },
  timerDanger: {
    color: '#FF2E63',
  },
  questionCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#171B18',
    borderWidth: 3,
    flex: 1,
    justifyContent: 'center',
    marginTop: 18,
    padding: 22,
    shadowColor: '#39FF88',
    shadowOffset: { height: 8, width: 8 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  cardNoiseRow: {
    flexDirection: 'row',
    gap: 8,
    left: 18,
    position: 'absolute',
    top: 18,
  },
  pixel: {
    backgroundColor: '#171B18',
    height: 10,
    width: 10,
  },
  pixelWide: {
    backgroundColor: '#39FF88',
    height: 10,
    width: 34,
  },
  questionTag: {
    color: '#189B54',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 18,
  },
  questionText: {
    color: '#171B18',
    fontSize: 27,
    fontWeight: '900',
    letterSpacing: 0,
    lineHeight: 38,
  },
  feedbackText: {
    color: '#4A514C',
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 21,
    marginTop: 22,
    minHeight: 46,
  },
  feedbackWrong: {
    color: '#FF2E63',
  },
  rankResult: {
    alignItems: 'center',
    alignSelf: 'center',
    borderColor: '#171B18',
    borderWidth: 3,
    gap: 12,
    minHeight: 172,
    justifyContent: 'center',
    marginTop: 24,
    padding: 22,
    width: '88%',
  },
  rankName: {
    color: '#171B18',
    fontSize: 42,
    fontWeight: '900',
  },
  rankStat: {
    color: '#4A514C',
    fontSize: 18,
    fontWeight: '900',
  },
  endActions: {
    gap: 12,
    marginTop: 18,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#171B18',
    borderColor: '#39FF88',
    borderWidth: 3,
    justifyContent: 'center',
    minHeight: 56,
  },
  secondaryButtonText: {
    color: '#39FF88',
    fontSize: 17,
    fontWeight: '900',
  },
  reviewShell: {
    flex: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  subjectShell: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingVertical: 16,
  },
  subjectTitle: {
    color: '#171B18',
    fontSize: 44,
    fontWeight: '900',
    lineHeight: 50,
  },
  subjectSubtitle: {
    color: '#4A514C',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 8,
  },
  subjectGrid: {
    gap: 12,
    marginBottom: 18,
    marginTop: 28,
  },
  subjectButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#171B18',
    borderWidth: 3,
    justifyContent: 'center',
    minHeight: 76,
    shadowColor: '#171B18',
    shadowOffset: { height: 4, width: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  subjectButtonText: {
    color: '#171B18',
    fontSize: 24,
    fontWeight: '900',
  },
  reviewTitle: {
    color: '#171B18',
    fontSize: 42,
    fontWeight: '900',
    lineHeight: 48,
  },
  reviewSubtitle: {
    color: '#4A514C',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 6,
  },
  reviewList: {
    gap: 12,
    paddingBottom: 18,
    paddingTop: 18,
  },
  reviewCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#171B18',
    borderWidth: 3,
    padding: 16,
  },
  reviewCase: {
    color: '#189B54',
    fontSize: 13,
    fontWeight: '900',
    marginBottom: 8,
  },
  reviewQuestion: {
    color: '#171B18',
    fontSize: 18,
    fontWeight: '900',
    lineHeight: 26,
  },
  reviewAnswer: {
    color: '#FF2E63',
    fontSize: 14,
    fontWeight: '900',
    marginTop: 12,
  },
  reviewNote: {
    color: '#4A514C',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 20,
    marginTop: 8,
  },
  answerRow: {
    flexDirection: 'row',
    gap: 14,
    marginTop: 20,
  },
  answerButton: {
    alignItems: 'center',
    borderColor: '#171B18',
    borderWidth: 3,
    flex: 1,
    justifyContent: 'center',
    minHeight: 122,
    shadowColor: '#171B18',
    shadowOffset: { height: 5, width: 5 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  answerO: {
    backgroundColor: '#39FF88',
  },
  answerX: {
    backgroundColor: '#FFFFFF',
  },
  answerActive: {
    borderColor: '#39FF88',
    borderWidth: 5,
  },
  answerDisabled: {
    opacity: 0.55,
  },
  answerLabel: {
    color: '#171B18',
    fontSize: 58,
    fontWeight: '900',
    lineHeight: 62,
  },
  answerCaption: {
    color: '#171B18',
    fontSize: 12,
    fontWeight: '900',
    marginTop: 4,
  },
});
