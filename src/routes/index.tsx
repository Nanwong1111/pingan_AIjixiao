import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Sparkles, Send, FileText, Bell, X,
  Mail, Pencil, Check, RefreshCw, Star, Loader2, Mailbox, MessageCircle, AlertCircle,
  ChevronDown, ChevronLeft, ChevronRight, Target, BriefcaseBusiness, Plus, Clock3, PanelRight, ScanLine,
  Maximize2, Minimize2, Minus, BookOpenText, ClipboardList, ListChecks, MessageSquareText, CircleHelp,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  getSubordinateData, saveFeedbackRecord, listFeedbackRecords,
  type SubData,
} from "@/lib/performance.functions";

export const Route = createFileRoute("/")({ component: Workbench });

type Subordinate = {
  id: string; name: string; initial: string; title: string;
  status: SubStatus;
  type: "direct" | "indirect";
  score?: number;
};

type SubmittedFeedback = {
  score: number;
  highlights: string;
  shortcomings: string;
  nextFocus: string;
  submittedAt: string;
  period: string;
};

type SubMonthlyReportRecord = {
  period: string;
  original: string;
  highlights: string;
  shortcomings: string;
  nextFocus: string;
};

type SubStatus = "pending_feedback" | "not_submitted" | "reminded" | "confirmed";
type OrgStatusFilter = "pending_feedback" | "pending_submit" | "confirmed" | "all";

type AIMode = "default" | "scoring" | "generated" | "editing" | "sent" | "personal_scoring" | "personal_generated" | "personal_editing" | "assessment_ranking";
type AIPanelMode = "docked" | "floating" | "fullscreen" | "closed";
type ManagerModuleKey = "plan" | "tracking" | "assessment";
type ReportTabKey = "monthly" | "midyear";
type ManagerOrgVersion = "v1" | "v2" | "v3" | "v4";
type VersionThreeWorkTab = "report" | "feedback";
type VersionFourTargetId = "self" | string;
type VersionFourWriteMode = "choice" | "direct" | "ai";
type VersionFourSubGroupFilter = "direct" | "indirect";
type VersionFourDemoRole = "manager" | "employee" | "new_employee" | "new_manager";
type PersonalMonthlyReportStatus = "pending_submit" | "waiting_feedback" | "feedback_done";
type PersonalReportWorkMode = "direct" | "ai";
type FeedbackWorkMode = "direct" | "ai";
type AIWorkContext = "personal_report" | "feedback" | null;
type MonthlyGuideKind = "summary" | "feedback";
type ReportGuideCycle = "monthly" | "midyear";
type GuideStep = {
  id: string;
  title: string;
  subtitle: string;
  icon: typeof ListChecks;
  tone: string;
  badge: string;
  headline: string;
  sections: readonly { title: string; items: readonly string[] }[];
};
type MonthlyMetricItem = {
  tag?: string;
  title: string;
  task?: string;
  goal: string;
  weight?: string;
  self: string | number;
  last: string | number;
  current?: string;
  note: string;
};
type PersonalMonthlyReportRecord = {
  period: string;
  submittedAt: string;
  original: string;
  highlights: string;
  shortcomings: string;
  nextFocus: string;
};
type PersonalMonthlyMetricItem = MonthlyMetricItem & {
  tag: "核心 KPI" | "关键工作";
  current: string;
};
type SubmittedPersonalMonthlyReport = {
  report: PersonalMonthlyReportRecord;
  metrics: PersonalMonthlyMetricItem[];
};

const REMIND_COOLDOWN_MS = 5 * 60 * 1000;
const MONTHLY_REPORT_GUIDE_STORAGE_KEY = "performance-hub-monthly-report-guide-dismissed";

function getReportGuideCycle(activeTab: ReportTabKey): ReportGuideCycle {
  return activeTab === "midyear" ? "midyear" : "monthly";
}

function getReportCycleCopy(activeTab: ReportTabKey) {
  const isMidyear = activeTab === "midyear";
  return {
    isMidyear,
    periodKey: isMidyear ? "2026-MIDYEAR" : getCurrentMonthPeriod(),
    periodLabel: isMidyear ? "2026年中绩效" : `${getCurrentMonthPeriod()} 月度绩效`,
    reportName: isMidyear ? "年中汇报" : "月度汇报",
    personalReportName: isMidyear ? "个人年中汇报" : "个人月度汇报",
    summaryName: isMidyear ? "年中绩效总结" : "月度绩效总结",
    feedbackName: isMidyear ? "年中反馈" : "月度反馈",
    feedbackFullName: isMidyear ? "年中绩效反馈" : "月度绩效反馈",
    submittedSummaryName: isMidyear ? "年中总结" : "月度总结",
    guideButtonText: isMidyear ? "年中汇报指南" : "月度汇报指南",
    guideSubtitle: isMidyear ? "核心KPI、关键工作、贡献亮点、不足反思和反馈要点" : "新人填报、评分和上级反馈要点",
    sourceText: isMidyear ? "核心KPI、关键工作、1-6月月度汇报、历史主管反馈和附件材料" : "本期绩效目标、月报、KPI 和历史反馈",
    nextFocusLabel: isMidyear ? "下阶段建议" : "下月重点",
  };
}

const MANAGER_MODULE_NAV = [
  { key: "plan", label: "计划", icon: FileText },
  { key: "tracking", label: "追踪", icon: ScanLine },
  { key: "assessment", label: "考核", icon: Star },
];

const VERSION_ONE_REPORT_TABS = [
  { key: "monthly", label: "月度汇报", icon: ScanLine },
] as const;

const VERSION_FOUR_REPORT_TABS = [
  { key: "monthly", label: "月度汇报", icon: ScanLine },
  { key: "midyear", label: "年中汇报", icon: ClipboardList },
] as const;

const ORG_STATUS_FILTERS: { key: OrgStatusFilter; label: string }[] = [
  { key: "pending_feedback", label: "待反馈" },
  { key: "pending_submit", label: "待提交" },
  { key: "confirmed", label: "已确认" },
  { key: "all", label: "全部" },
];

const ORG_STATUS_SORT_ORDER: Record<SubStatus, number> = {
  pending_feedback: 0,
  not_submitted: 1,
  reminded: 1,
  confirmed: 2,
};

const VERSION_FOUR_DEMO_ROLES: Array<{ key: VersionFourDemoRole; label: string; detail: string }> = [
  { key: "new_manager", label: "新晋管理者", detail: "展示反馈引导" },
  { key: "manager", label: "管理者", detail: "个人汇报 + 下属反馈" },
  { key: "new_employee", label: "新员工", detail: "展示填报引导" },
  { key: "employee", label: "普通员工", detail: "仅处理个人汇报" },
];

const CURRENT_PERIOD = "2026-04";
const CURRENT_USER = {
  name: "龙泉",
  initial: "龙",
  title: "产险公司董事长兼CEO",
  company: "产险公司",
  supervisor: "郭晓涛",
};

const MANAGER_DETAIL_SUB: Subordinate = {
  id: "manager-longquan",
  name: CURRENT_USER.name,
  initial: CURRENT_USER.initial,
  title: CURRENT_USER.title,
  status: "confirmed",
  type: "direct",
  score: 86,
};

const MANAGER_AVATAR_URL = "/avatars/longquan.png";
const PERSON_AVATAR_BY_NAME: Record<string, string> = {
  龙泉: MANAGER_AVATAR_URL,
  丁珂珂: "/avatars/ding-keke.png",
  史良洵: "/avatars/shi-liangxun.png",
  徐华: "/avatars/xu-hua.png",
  李亚男: "/avatars/li-yanan.png",
  张振勇: "/avatars/zhang-zhenyong.png",
  裴斌: "/avatars/pei-bin.jpg",
  徐霆: "/avatars/xu-ting.png",
  姜华: "/avatars/jiang-hua.png",
  韩宪君: "/avatars/han-xianjun.png",
  曹敬之: "/avatars/cao-jingzhi.png",
  朱曦: "/avatars/zhu-xi.png",
};

const INITIAL_SUBS: (Omit<Subordinate, "status"> & { status: SubStatus })[] = [
  { id: "1", name: "史良洵", initial: "史", title: "产险公司总经理", status: "not_submitted", type: "direct" },
  { id: "2", name: "丁珂珂", initial: "丁", title: "产险公司副总经理", status: "pending_feedback", type: "direct", score: 85 },
  { id: "3", name: "徐华", initial: "徐", title: "产险总公司总经理助理", status: "pending_feedback", type: "direct", score: 82 },
  { id: "4", name: "李亚男", initial: "李", title: "产险总公司总经理助理", status: "pending_feedback", type: "direct", score: 79 },
  { id: "5", name: "张振勇", initial: "张", title: "产险总公司总经理助理", status: "not_submitted", type: "direct" },
  { id: "6", name: "裴斌", initial: "裴", title: "产险总部理赔运营中心作业管理团队总经理", status: "not_submitted", type: "direct" },
  { id: "7", name: "徐霆", initial: "徐", title: "产险总公司总经理助理", status: "not_submitted", type: "indirect" },
  { id: "8", name: "姜华", initial: "姜", title: "产险总公司总经理助理", status: "not_submitted", type: "indirect" },
  { id: "9", name: "韩宪君", initial: "韩", title: "产险总公司总经理助理", status: "not_submitted", type: "indirect" },
  { id: "10", name: "曹敬之", initial: "曹", title: "产险总公司总经理助理", status: "not_submitted", type: "indirect" },
  { id: "11", name: "朱曦", initial: "朱", title: "产险总公司总经理助理", status: "not_submitted", type: "indirect" },
  { id: "12", name: "石合群", initial: "石", title: "产险总部团体事业群总监", status: "not_submitted", type: "indirect" },
  { id: "13", name: "赵涛", initial: "赵", title: "产险总部理赔运营中心作业管理团队副总经理", status: "not_submitted", type: "indirect" },
  { id: "14", name: "樊增建", initial: "樊", title: "产险总部科技中心团体研发团队总经理", status: "not_submitted", type: "indirect" },
  { id: "15", name: "石得", initial: "石", title: "产险总部团体事业群总监", status: "not_submitted", type: "indirect" },
  { id: "16", name: "边亚宁", initial: "边", title: "产险总部人力资源与行政服务团队总经理", status: "not_submitted", type: "indirect" },
  { id: "17", name: "佘为政", initial: "佘", title: "产险甘肃分公司总经理", status: "not_submitted", type: "indirect" },
  { id: "18", name: "韩维", initial: "韩", title: "产险重庆分公司总经理", status: "not_submitted", type: "indirect" },
  { id: "19", name: "曹阳", initial: "曹", title: "产险四川分公司总经理", status: "not_submitted", type: "indirect" },
  { id: "20", name: "古文忠", initial: "古", title: "产险青海分公司总经理", status: "not_submitted", type: "indirect" },
  { id: "21", name: "叶青", initial: "叶", title: "产险江苏分公司总经理", status: "not_submitted", type: "indirect" },
  { id: "22", name: "宣浪", initial: "宣", title: "产险深圳分公司临时负责人", status: "not_submitted", type: "indirect" },
  { id: "23", name: "庞宁波", initial: "庞", title: "产险宁波分公司总经理", status: "not_submitted", type: "indirect" },
  { id: "24", name: "刘胜", initial: "刘", title: "产险浙江分公司总经理", status: "not_submitted", type: "indirect" },
  { id: "25", name: "王文进", initial: "王", title: "产险湖北分公司总经理", status: "not_submitted", type: "indirect" },
  { id: "26", name: "黄医华", initial: "黄", title: "产险温州分公司总经理", status: "not_submitted", type: "indirect" },
  { id: "27", name: "张小春", initial: "张", title: "产险安徽分公司总经理", status: "not_submitted", type: "indirect" },
  { id: "28", name: "郝瑞林", initial: "郝", title: "产险江西分公司总经理（副总经理级）", status: "not_submitted", type: "indirect" },
  { id: "29", name: "梁中伟", initial: "梁", title: "产险苏州分公司临时负责人", status: "not_submitted", type: "indirect" },
  { id: "30", name: "林辉", initial: "林", title: "产险厦门分公司总经理", status: "not_submitted", type: "indirect" },
  { id: "31", name: "谢圣华", initial: "谢", title: "产险新疆分公司副总经理（主持工作）", status: "not_submitted", type: "indirect" },
  { id: "32", name: "陈雪松", initial: "陈", title: "产险河南分公司总经理", status: "not_submitted", type: "indirect" },
  { id: "33", name: "王然", initial: "王", title: "产险佛山分公司总经理", status: "not_submitted", type: "indirect" },
  { id: "34", name: "王辉", initial: "王", title: "产险山东分公司总经理", status: "not_submitted", type: "indirect" },
  { id: "35", name: "钱鸿华", initial: "钱", title: "产险陕西分公司总经理", status: "not_submitted", type: "indirect" },
  { id: "36", name: "黎明", initial: "黎", title: "产险辽宁分公司总经理", status: "not_submitted", type: "indirect" },
  { id: "37", name: "刘吉松", initial: "刘", title: "产险山西分公司临时负责人", status: "not_submitted", type: "indirect" },
  { id: "38", name: "梁晓东", initial: "梁", title: "产险天津分公司总经理", status: "not_submitted", type: "indirect" },
  { id: "39", name: "杨晓迪", initial: "杨", title: "产险大连分公司总经理（副总经理级）", status: "not_submitted", type: "indirect" },
  { id: "40", name: "刘浩", initial: "刘", title: "产险河北分公司总经理", status: "not_submitted", type: "indirect" },
  { id: "41", name: "曹旭", initial: "曹", title: "产险福建分公司总经理", status: "not_submitted", type: "indirect" },
  { id: "42", name: "李桥", initial: "李", title: "产险黑龙江分公司总经理", status: "not_submitted", type: "indirect" },
  { id: "43", name: "王长青", initial: "王", title: "产险内蒙古分公司总经理", status: "not_submitted", type: "indirect" },
  { id: "44", name: "刘晓琛", initial: "刘", title: "产险吉林分公司总经理", status: "not_submitted", type: "indirect" },
  { id: "45", name: "葛增强", initial: "葛", title: "产险唐山分公司总经理", status: "not_submitted", type: "indirect" },
  { id: "46", name: "黄俊斌", initial: "黄", title: "产险贵州分公司总经理", status: "not_submitted", type: "indirect" },
  { id: "47", name: "朱成成", initial: "朱", title: "产险无锡分公司临时负责人", status: "not_submitted", type: "indirect" },
  { id: "48", name: "彭炬", initial: "彭", title: "产险云南分公司总经理", status: "not_submitted", type: "indirect" },
  { id: "49", name: "李剑云", initial: "李", title: "产险北京分公司总经理", status: "not_submitted", type: "indirect" },
  { id: "50", name: "杨晋峰", initial: "杨", title: "产险广西分公司临时负责人", status: "not_submitted", type: "indirect" },
  { id: "51", name: "曾阳", initial: "曾", title: "产险东莞分公司业务负责人", status: "not_submitted", type: "indirect" },
  { id: "52", name: "吴斌", initial: "吴", title: "产险广东分公司总经理", status: "not_submitted", type: "indirect" },
  { id: "53", name: "冯征", initial: "冯", title: "产险湖南分公司总经理", status: "not_submitted", type: "indirect" },
  { id: "54", name: "曹志文", initial: "曹", title: "产险深圳分公司总经理", status: "not_submitted", type: "indirect" },
  { id: "55", name: "何莹", initial: "何", title: "产险上海分公司总经理", status: "not_submitted", type: "indirect" },
  { id: "56", name: "张胜亮", initial: "张", title: "产险宁夏分公司总经理（副总经理级）", status: "not_submitted", type: "indirect" },
  { id: "57", name: "阳中义", initial: "阳", title: "产险西藏分公司总经理（副总经理级）", status: "not_submitted", type: "indirect" },
];

const KPIS = [
  { tag: "核心KPI", title: "考核利润", weight: "50%", task: "推动产险整体利润达成", goal: "底线xxx亿、市场线xxx亿、计划线xxx亿、标杆线xxx亿" },
  { tag: "核心KPI", title: "份额提升", weight: "25%", task: "提升核心业务市场份额", goal: "底线x%、市场线x%、计划线x%、标杆线xx%" },
  { tag: "核心KPI", title: "COR优于市场", weight: "25%", task: "保持成本率优于市场", goal: "底线x%、市场线x%、计划线x%、标杆线xx%" },
];
const KEY_WORK = [
  { title: "车险两地牌照一体化管理", goal: "根据集团要求，4月底前汇报马总" },
  { title: "非车发展策略", goal: "围绕健康险、宠物险、小微综合保险和企康推动年度目标达成" },
  { title: "车险HS发展策略", goal: "潜客100万、主体覆盖率60%、机构渗透率60%" },
];

function getPersonAvatarUrl(id: string, name?: string) {
  if (name && PERSON_AVATAR_BY_NAME[name]) {
    return PERSON_AVATAR_BY_NAME[name];
  }
  const n = Number(id);
  const avatarIndex = Number.isFinite(n) ? ((n - 1) % 15) + 1 : 1;
  return `/avatars/chinese-male-${String(avatarIndex).padStart(2, "0")}.png`;
}

function Avatar({
  initial,
  size = "md",
  src,
  alt,
}: {
  initial: string;
  size?: "sm" | "md" | "lg";
  src?: string;
  alt?: string;
}) {
  const cls = size === "lg" ? "h-14 w-14 text-xl" : size === "sm" ? "h-9 w-9 text-sm" : "h-11 w-11 text-base";
  if (src) {
    return (
      <img
        src={src}
        alt={alt ?? ""}
        className={`${cls} shrink-0 rounded-xl object-cover shadow-sm ring-1 ring-white/90`}
      />
    );
  }
  return (
    <div className={`${cls} shrink-0 rounded-xl bg-primary text-primary-foreground font-semibold flex items-center justify-center shadow-sm`}>
      {initial}
    </div>
  );
}

function StatusPill({ status }: { status: Subordinate["status"] }) {
  const map: Record<SubStatus, { text: string; cls: string }> = {
    pending_feedback: { text: "待反馈", cls: "bg-primary-soft text-accent-foreground" },
    not_submitted: { text: "未提交", cls: "bg-muted text-muted-foreground" },
    reminded: { text: "已催办", cls: "bg-warning-soft text-warning" },
    confirmed: { text: "已确认", cls: "bg-success-soft text-success" },
  };
  const s = map[status];
  return <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${s.cls}`}>{s.text}</span>;
}

function Workbench() {
  const [selectedSub, setSelectedSub] = useState<Subordinate | null>(null);
  const [aiMode, setAiMode] = useState<AIMode>("default");
  const [scores, setScores] = useState<Record<string, number>>({});
  const [subs, setSubs] = useState<Subordinate[]>(INITIAL_SUBS);
  const [remindedAtById, setRemindedAtById] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());
  const [personalReportStatus, setPersonalReportStatus] = useState<PersonalMonthlyReportStatus>("pending_submit");
  const [submittedPersonalReports, setSubmittedPersonalReports] = useState<Record<string, SubmittedPersonalMonthlyReport>>({});
  const [submittedFeedbackBySubId, setSubmittedFeedbackBySubId] = useState<Record<string, SubmittedFeedback>>({});
  const [aiPanelMode, setAiPanelMode] = useState<AIPanelMode>("docked");
  const [managerOrgVersion, setManagerOrgVersion] = useState<ManagerOrgVersion>("v2");
  const [versionOneReportTab, setVersionOneReportTab] = useState<ReportTabKey>("monthly");
  const [versionThreeWorkTab, setVersionThreeWorkTab] = useState<VersionThreeWorkTab>("report");
  const [versionFourDemoRole, setVersionFourDemoRole] = useState<VersionFourDemoRole>("new_manager");
  const [feedbackSidebarCollapsed, setFeedbackSidebarCollapsed] = useState(false);
  const [v2PreviewSubId, setV2PreviewSubId] = useState<string | null>(null);
  const [personalDetailOpen, setPersonalDetailOpen] = useState(false);
  const [personalDetailSide, setPersonalDetailSide] = useState<"left" | "right">("left");
  const [personalReportWorkMode, setPersonalReportWorkMode] = useState<PersonalReportWorkMode>("direct");
  const [feedbackWorkMode, setFeedbackWorkMode] = useState<FeedbackWorkMode>("direct");
  const [personalMetricFocusTick, setPersonalMetricFocusTick] = useState(0);
  const [detailPanelExpanded, setDetailPanelExpanded] = useState(false);
  const [aiFloatingPosition, setAiFloatingPosition] = useState<{ x: number; y: number } | null>(null);
  const [activeModule, setActiveModule] = useState<ManagerModuleKey>("tracking");
  const [aiWorkContext, setAiWorkContext] = useState<AIWorkContext>(null);
  const [monthlyGuideOpen, setMonthlyGuideOpen] = useState(false);
  const [monthlyGuideKind, setMonthlyGuideKind] = useState<MonthlyGuideKind>("feedback");
  const aiDragOffsetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const module = new URLSearchParams(window.location.search).get("module");
    if (module === "plan" || module === "tracking" || module === "assessment") {
      setActiveModule(module);
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const orgVersion = params.get("orgVersion");
    if (orgVersion === "v1" || orgVersion === "v2" || orgVersion === "v3" || orgVersion === "v4") {
      setManagerOrgVersion(orgVersion);
    }
    const reportTab = params.get("reportTab");
    if (reportTab === "monthly" || reportTab === "midyear") {
      setVersionOneReportTab(reportTab);
    }
    const workTab = params.get("workTab");
    if (workTab === "report" || workTab === "feedback") {
      setVersionThreeWorkTab(workTab);
    }
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const urlVersion = new URLSearchParams(window.location.search).get("orgVersion");
    if (urlVersion === "v4" || managerOrgVersion === "v4") return;
    try {
      if (window.localStorage.getItem(MONTHLY_REPORT_GUIDE_STORAGE_KEY) !== "1") {
        setMonthlyGuideOpen(true);
      }
    } catch {
      setMonthlyGuideOpen(true);
    }
  }, [managerOrgVersion]);

  useEffect(() => {
    if (aiMode === "assessment_ranking" && aiPanelMode === "floating") {
      setAiPanelMode("docked");
    }
  }, [aiMode, aiPanelMode]);

  const closeMonthlyGuide = () => {
    setMonthlyGuideOpen(false);
    try {
      window.localStorage.setItem(MONTHLY_REPORT_GUIDE_STORAGE_KEY, "1");
    } catch {
      // Ignore storage errors; the top navigation entry remains available.
    }
  };

  const openMonthlyGuide = (kind: MonthlyGuideKind = "feedback") => {
    setMonthlyGuideKind(kind);
    setMonthlyGuideOpen(true);
  };

  const pendingFeedbackCount = subs.filter((s) => s.status === "pending_feedback").length;
  const notSubmittedSubs = subs.filter((s) => s.status === "not_submitted" || s.status === "reminded");
  const notSubmittedCount = notSubmittedSubs.length;
  const confirmedCount = subs.filter((s) => s.status === "confirmed").length;

  useEffect(() => {
    if (managerOrgVersion !== "v3" || versionThreeWorkTab !== "feedback" || selectedSub) return;
    const firstPendingSub = subs.find((sub) => sub.status === "pending_feedback") ?? subs[0];
    if (firstPendingSub) {
      setSelectedSub(firstPendingSub);
      setScores(getDefaultFeedbackScores());
    }
  }, [managerOrgVersion, versionThreeWorkTab, selectedSub, subs]);

  const getRemindCooldownMs = (id: string) =>
    Math.max(0, (remindedAtById[id] ?? 0) + REMIND_COOLDOWN_MS - now);

  const remind = (ids: string[]) => {
    const sentAt = Date.now();
    const idSet = new Set(ids);
    setRemindedAtById((prev) => ({
      ...prev,
      ...Object.fromEntries(ids.map((id) => [id, sentAt])),
    }));
    setSubs((prev) => prev.map((s) => (idSet.has(s.id) ? { ...s, status: "reminded" } : s)));
    setSelectedSub((prev) => (prev && idSet.has(prev.id) ? { ...prev, status: "reminded" } : prev));
  };

  const openPersonalPerformanceDetail = (focusMetrics = false, side: "left" | "right" = "left") => {
    setPersonalDetailSide(side);
    setPersonalDetailOpen(true);
    if (focusMetrics) {
      setPersonalMetricFocusTick((tick) => tick + 1);
    }
  };

  const startWriteReport = () => {
    setPersonalDetailOpen(false);
    setSelectedSub(null);
    setAiWorkContext("personal_report");
    setAiPanelMode("docked");
    setPersonalReportWorkMode("direct");
    setAiMode("default");
  };

  const startWriteFeedback = (sub: Subordinate) => {
    setSelectedSub(sub);
    setScores(getDefaultFeedbackScores());
    setPersonalDetailOpen(false);
    setAiWorkContext("feedback");
    setAiPanelMode("docked");
    setFeedbackWorkMode("direct");
    setAiMode("default");
  };

  const switchFeedbackSub = (sub: Subordinate) => {
    setSelectedSub(sub);
    setScores(getDefaultFeedbackScores());
    if (feedbackWorkMode === "ai") {
      setAiMode("scoring");
    }
  };

  const switchVersionThreeWorkTab = (nextTab: VersionThreeWorkTab) => {
    const firstPendingSub = subs.find((sub) => sub.status === "pending_feedback") ?? subs[0] ?? null;
    setVersionThreeWorkTab(nextTab);
    setAiWorkContext(null);
    if (nextTab === "feedback") {
      const nextSub = selectedSub ?? firstPendingSub;
      if (nextSub) {
        setSelectedSub(nextSub);
        setScores(getDefaultFeedbackScores());
      }
      setAiMode(feedbackWorkMode === "ai" && nextSub ? "scoring" : "default");
    } else {
      setAiMode(personalReportWorkMode === "ai" ? "personal_scoring" : "default");
    }
  };

  const submitSupervisorFeedback = (subId: string, feedback: SubmittedFeedback) => {
    setSubmittedFeedbackBySubId((prev) => ({ ...prev, [subId]: feedback }));
    setSubs((prev) => prev.map((s) => (s.id === subId ? { ...s, score: feedback.score, status: "confirmed" } : s)));
    setSelectedSub((prev) => (prev?.id === subId ? { ...prev, score: feedback.score, status: "confirmed" } : prev));
  };

  const submitSupervisorFeedbackAndAdvance = (subId: string, feedback: SubmittedFeedback) => {
    const pendingBeforeSubmit = subs.filter((sub) => sub.status === "pending_feedback");
    const currentIndex = pendingBeforeSubmit.findIndex((sub) => sub.id === subId);
    const nextSub = pendingBeforeSubmit.length > 1
      ? pendingBeforeSubmit[(Math.max(currentIndex, 0) + 1) % pendingBeforeSubmit.length]
      : null;

    submitSupervisorFeedback(subId, feedback);

    if (nextSub) {
      setSelectedSub(nextSub);
      setScores(getDefaultFeedbackScores());
      setAiMode(feedbackWorkMode === "ai" ? "scoring" : "default");
    }
  };

  const submitPersonalMonthlyReport = (submittedReport: SubmittedPersonalMonthlyReport) => {
    setSubmittedPersonalReports((prev) => ({ ...prev, [submittedReport.report.period]: submittedReport }));
    setPersonalReportStatus("waiting_feedback");
  };

  const aiWideFlowActive = (aiWorkContext !== null || aiMode === "assessment_ranking") && aiPanelMode === "docked";
  const aiPanelClass =
    aiPanelMode === "fullscreen"
      ? "fixed inset-4 z-50 flex flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-[0_30px_90px_rgba(15,23,42,0.18)]"
    : aiPanelMode === "floating"
      ? "fixed z-40 flex w-[440px] flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-[0_24px_70px_rgba(15,23,42,0.16)]"
      : aiWideFlowActive
      ? "w-[50vw] shrink-0 border-l border-border bg-card sticky top-14 flex h-[calc(100vh-3.5rem)] flex-col"
      : "w-[400px] shrink-0 border-l border-border bg-card sticky top-14 flex h-[calc(100vh-3.5rem)] flex-col";

  const aiPanelStyle =
    aiPanelMode === "floating"
      ? aiFloatingPosition
        ? { left: aiFloatingPosition.x, top: aiFloatingPosition.y, height: "calc(100vh - 7rem)" }
        : { right: 24, top: 80, height: "calc(100vh - 7rem)" }
      : undefined;

  const startAiPanelDrag = (event: React.PointerEvent<HTMLDivElement>) => {
    if (aiPanelMode !== "floating") return;
    if ((event.target as HTMLElement).closest("button")) return;
    const panel = event.currentTarget.closest("[data-ai-panel]") as HTMLElement | null;
    if (!panel) return;
    const rect = panel.getBoundingClientRect();
    aiDragOffsetRef.current = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    event.currentTarget.setPointerCapture(event.pointerId);

    const movePanel = (moveEvent: PointerEvent) => {
      const maxX = Math.max(12, window.innerWidth - rect.width - 12);
      const maxY = Math.max(12, window.innerHeight - rect.height - 12);
      setAiFloatingPosition({
        x: Math.min(Math.max(12, moveEvent.clientX - aiDragOffsetRef.current.x), maxX),
        y: Math.min(Math.max(12, moveEvent.clientY - aiDragOffsetRef.current.y), maxY),
      });
    };

    const stopDrag = () => {
      window.removeEventListener("pointermove", movePanel);
      window.removeEventListener("pointerup", stopDrag);
      window.removeEventListener("pointercancel", stopDrag);
    };

    window.addEventListener("pointermove", movePanel);
    window.addEventListener("pointerup", stopDrag);
    window.addEventListener("pointercancel", stopDrag);
  };

  const updateWorkbenchUrl = (
    nextModule: ManagerModuleKey,
    nextOrgVersion = managerOrgVersion,
    nextReportTab = versionOneReportTab,
  ) => {
    const params = new URLSearchParams(window.location.search);
    params.set("orgVersion", nextOrgVersion);
    if (nextOrgVersion === "v1" || nextOrgVersion === "v3" || nextOrgVersion === "v4") {
      params.delete("module");
      params.set("reportTab", nextReportTab);
      params.delete("workTab");
    } else {
      params.set("module", nextModule);
      params.delete("reportTab");
      params.delete("workTab");
    }
    window.history.replaceState(null, "", `?${params.toString()}`);
  };

  const switchManagerOrgVersion = (nextVersion: ManagerOrgVersion) => {
    const nextReportTab: ReportTabKey = nextVersion === "v4" ? versionOneReportTab : "monthly";
    setManagerOrgVersion(nextVersion);
    setVersionOneReportTab(nextReportTab);
    if (nextVersion === "v2") {
      setDetailPanelExpanded(false);
    } else {
      setV2PreviewSubId(null);
    }
    if (nextVersion === "v3") {
      setVersionThreeWorkTab("report");
      setPersonalReportWorkMode("direct");
      setFeedbackWorkMode("direct");
    }
    setAiMode("default");
    setAiWorkContext(null);
    setAiPanelMode((mode) => mode === "closed" ? "docked" : mode);
    updateWorkbenchUrl(activeModule, nextVersion, nextReportTab);
  };

  const switchVersionOneReportTab = (nextTab: ReportTabKey) => {
    setVersionOneReportTab(nextTab);
    setAiMode("default");
    setAiWorkContext(null);
    setAiPanelMode((mode) => mode === "closed" ? "docked" : mode);
    updateWorkbenchUrl(activeModule, managerOrgVersion, nextTab);
  };

  const reportVersionActive = managerOrgVersion === "v1" || managerOrgVersion === "v3";
  const reportTabNavActive = reportVersionActive || managerOrgVersion === "v4";
  const activeReportTabs = managerOrgVersion === "v4" ? VERSION_FOUR_REPORT_TABS : VERSION_ONE_REPORT_TABS;
  const renderVersionThreeAssistant = (kind: VersionThreeWorkTab) => (
    <AIAssistant
      mode={aiMode}
      setMode={setAiMode}
      selectedSub={selectedSub}
      subs={subs}
      activeModule={activeModule}
      scores={scores}
      setScores={setScores}
      panelMode="docked"
      onSelectSub={setSelectedSub}
      onToggleFloating={() => {}}
      onToggleFullscreen={() => {}}
      onClosePanel={() => {
        if (kind === "report") {
          setPersonalReportWorkMode("direct");
        } else {
          setFeedbackWorkMode("direct");
        }
        setAiMode("default");
      }}
      onFeedbackSubmitted={kind === "feedback" ? submitSupervisorFeedbackAndAdvance : submitSupervisorFeedback}
      onPersonalConfirmed={(submittedReport) => {
        if (submittedReport) submitPersonalMonthlyReport(submittedReport);
      }}
      onStartFloatingDrag={() => {}}
      onStartPersonalReport={() => {
        setVersionThreeWorkTab("report");
        setPersonalReportWorkMode("ai");
        setAiMode("personal_scoring");
      }}
      onStartFeedback={(sub) => {
        setVersionThreeWorkTab("feedback");
        setSelectedSub(sub);
        setFeedbackWorkMode("ai");
        setScores(getDefaultFeedbackScores());
        setAiMode("scoring");
      }}
      onExitWorkContext={() => {
        setAiMode("default");
      }}
    />
  );

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur">
        <div className="flex h-14 items-center px-6">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <h1 className="text-base font-semibold tracking-tight whitespace-nowrap">绩效工作台</h1>
          </div>
          <div
            className="ml-8 flex h-9 items-center rounded-xl border border-border bg-background p-1"
            aria-label="系统版本切换"
          >
            {([
              ["v1", "版本一"],
              ["v2", "版本二"],
              ["v3", "版本三"],
              ["v4", "版本四"],
            ] as const).map(([version, label]) => {
              const active = managerOrgVersion === version;
              return (
                <button
                  key={version}
                  type="button"
                  onClick={() => switchManagerOrgVersion(version)}
                  className={`h-7 rounded-lg px-3 text-xs font-bold transition ${
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                  aria-pressed={active}
                >
                  {label}
                </button>
              );
            })}
          </div>
          <nav className="ml-8 flex h-full items-center gap-8">
            {reportTabNavActive ? (
              activeReportTabs.map((item) => {
                const active = item.key === versionOneReportTab;
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => switchVersionOneReportTab(item.key)}
                    className={`relative flex h-full items-center px-1 text-base font-semibold transition ${
                      active
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="mr-1.5 h-[17px] w-[17px]" strokeWidth={2.5} />
                    {item.label}
                    <span className={`absolute inset-x-0 bottom-0 mx-auto h-0.5 rounded-full bg-primary transition ${
                      active ? "opacity-100" : "opacity-0"
                    }`} />
                  </button>
                );
              })
            ) : (
              MANAGER_MODULE_NAV.map((item) => {
                const active = item.key === activeModule;
                const Icon = item.icon;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      const nextModule = item.key as ManagerModuleKey;
                      setActiveModule(nextModule);
                      setAiMode("default");
                      setAiWorkContext(null);
                      setAiPanelMode((mode) => mode === "closed" ? "docked" : mode);
                      updateWorkbenchUrl(nextModule);
                    }}
                    className={`relative flex h-full items-center px-1 text-base font-semibold transition ${
                      active
                        ? "text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="mr-1.5 h-[17px] w-[17px]" strokeWidth={2.5} />
                    {item.label}
                    <span className={`absolute inset-x-0 bottom-0 mx-auto h-0.5 rounded-full bg-primary transition ${
                      active ? "opacity-100" : "opacity-0"
                    }`} />
                  </button>
                );
              })
            )}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            {managerOrgVersion === "v4" && (
              <label className="flex h-9 items-center gap-2 rounded-xl border border-border bg-background px-3 shadow-sm">
                <span className="text-xs font-black text-muted-foreground">演示角色</span>
                <select
                  value={versionFourDemoRole}
                  onChange={(event) => setVersionFourDemoRole(event.target.value as VersionFourDemoRole)}
                  className="h-7 min-w-[112px] bg-transparent text-sm font-black text-foreground outline-none"
                  aria-label="切换版本四演示角色"
                >
                  {VERSION_FOUR_DEMO_ROLES.map((role) => (
                    <option key={role.key} value={role.key}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </div>
        </div>
      </header>

      <div className="flex">
        <main className="min-w-0 flex-1 bg-background">
          {managerOrgVersion === "v4" ? (
            <VersionFourAiWorkspace
              demoRole={versionFourDemoRole}
              activeTab={versionOneReportTab}
              subs={subs}
              submittedFeedbackBySubId={submittedFeedbackBySubId}
              submittedPersonalReports={submittedPersonalReports}
              personalReportStatus={personalReportStatus}
              onSelectSub={setSelectedSub}
              onPersonalSubmitted={(submittedReport) => {
                submitPersonalMonthlyReport(submittedReport);
                toast.success("月度汇报已由 AI 录入系统");
              }}
              onFeedbackSubmitted={submitSupervisorFeedbackAndAdvance}
              getRemindCooldownMs={getRemindCooldownMs}
              onRemindSub={(sub) => {
                if (getRemindCooldownMs(sub.id) > 0) return;
                remind([sub.id]);
                toast.success(`已发送催办邮件给 ${sub.name}`);
              }}
              onOpenMonthlyGuide={openMonthlyGuide}
            />
          ) : managerOrgVersion === "v3" ? (
            <VersionThreeWritingWorkspace
              activeTab={versionThreeWorkTab}
              personalReportStatus={personalReportStatus}
              selectedSub={selectedSub}
              feedbackSubs={subs}
              sidebarCollapsed={feedbackSidebarCollapsed}
              submittedFeedbackBySubId={submittedFeedbackBySubId}
              submittedPersonalReports={submittedPersonalReports}
              personalReportWorkMode={personalReportWorkMode}
              feedbackWorkMode={feedbackWorkMode}
              onTabChange={switchVersionThreeWorkTab}
              onToggleSidebar={() => setFeedbackSidebarCollapsed((collapsed) => !collapsed)}
              onSelectFeedbackSub={switchFeedbackSub}
              onPersonalModeChange={(mode) => {
                setPersonalReportWorkMode(mode);
                setAiMode(mode === "ai" ? "personal_scoring" : "default");
              }}
              onFeedbackModeChange={(mode) => {
                setFeedbackWorkMode(mode);
                setAiMode(mode === "ai" && selectedSub ? "scoring" : "default");
              }}
              getRemindCooldownMs={getRemindCooldownMs}
              onRemindSub={(sub) => {
                if (getRemindCooldownMs(sub.id) > 0) return;
                remind([sub.id]);
                toast.success(`已发送催办邮件给 ${sub.name}`);
              }}
              onPersonalSubmitted={(submittedReport) => {
                submitPersonalMonthlyReport(submittedReport);
                toast.success("月度汇报已录入系统");
              }}
              onFeedbackSubmitted={submitSupervisorFeedbackAndAdvance}
              reportAiContent={renderVersionThreeAssistant("report")}
              feedbackAiContent={renderVersionThreeAssistant("feedback")}
            />
          ) : aiWorkContext !== null && aiPanelMode === "docked" ? (
            <FocusedPerformanceWorkspace
              context={aiWorkContext}
              selectedSub={selectedSub}
              submittedFeedbackBySubId={submittedFeedbackBySubId}
              submittedPersonalReports={submittedPersonalReports}
              feedbackSwitchSubs={subs.filter((s) => s.status === "pending_feedback")}
              onSwitchFeedbackSub={switchFeedbackSub}
              onWriteFeedback={startWriteFeedback}
              onRemindSub={(sub) => {
                if (getRemindCooldownMs(sub.id) > 0) return;
                remind([sub.id]);
                toast.success(`已发送催办邮件给 ${sub.name}`);
              }}
              getRemindCooldownMs={getRemindCooldownMs}
              onExit={() => setAiWorkContext(null)}
            />
          ) : reportVersionActive ? (
            <VersionOneReportWorkspace
              activeTab={versionOneReportTab}
              personalReportStatus={personalReportStatus}
              subs={subs}
              selectedSub={selectedSub}
              submittedFeedbackBySubId={submittedFeedbackBySubId}
              submittedPersonalReports={submittedPersonalReports}
              pendingFeedbackCount={pendingFeedbackCount}
              notSubmittedCount={notSubmittedCount}
              confirmedCount={confirmedCount}
              notSubmittedSubs={notSubmittedSubs}
              v2PreviewSubId={v2PreviewSubId}
              detailPanelExpanded={detailPanelExpanded}
              cooldowns={Object.fromEntries(notSubmittedSubs.map((s) => [s.id, getRemindCooldownMs(s.id)]))}
              onStartPersonalReport={startWriteReport}
              onOpenPersonalDetail={() => openPersonalPerformanceDetail(false, "right")}
              onSelectSub={setSelectedSub}
              onPreviewSub={(sub) => {
                setSelectedSub(sub);
                setV2PreviewSubId(sub.id);
              }}
              onClosePreview={() => setV2PreviewSubId(null)}
              onWriteFeedback={startWriteFeedback}
              getRemindCooldownMs={getRemindCooldownMs}
              onRemindSub={(sub) => {
                if (getRemindCooldownMs(sub.id) > 0) return;
                remind([sub.id]);
                toast.success(`已发送催办邮件给 ${sub.name}`);
              }}
              onRemind={(ids) => {
                remind(ids);
                toast.success(`已发送催办邮件给 ${ids.length} 名下属`);
              }}
              onBackToTeam={() => {
                setSelectedSub(null);
                setDetailPanelExpanded(false);
              }}
              onToggleDetailExpanded={() => setDetailPanelExpanded((expanded) => !expanded)}
            />
          ) : activeModule === "assessment" ? (
            <AssessmentDashboard
              subs={subs}
              selectedSub={selectedSub}
              submittedFeedbackBySubId={submittedFeedbackBySubId}
              onSelectSub={setSelectedSub}
              onOpenPerformanceDetail={() => openPersonalPerformanceDetail()}
              onWriteFeedback={startWriteFeedback}
            />
          ) : activeModule === "plan" ? (
            <ManagerPlanBoard />
          ) : (
            <div className="p-5">
              <PersonalPerformanceOverview />
              <div className={`relative mt-4 ${managerOrgVersion === "v2" ? "" : "flex items-start gap-6"}`}>
                <div className={reportVersionActive ? "w-[360px] shrink-0" : ""}>
                  <OrgChartPanel
                    subs={subs}
                    selectedId={selectedSub?.id}
                    activeVersion={managerOrgVersion}
                    previewSubId={v2PreviewSubId}
                    pendingFeedbackCount={pendingFeedbackCount}
                    notSubmittedCount={notSubmittedCount}
                    confirmedCount={confirmedCount}
                    pendingFeedbackSubs={subs.filter((s) => s.status === "pending_feedback")}
                    notSubmittedSubs={notSubmittedSubs}
                    cooldowns={Object.fromEntries(notSubmittedSubs.map((s) => [s.id, getRemindCooldownMs(s.id)]))}
                    submittedFeedbackBySubId={submittedFeedbackBySubId}
                    onSelect={setSelectedSub}
                    onPreviewSub={(sub) => {
                      setSelectedSub(sub);
                      setV2PreviewSubId(sub.id);
                    }}
                    onClosePreview={() => setV2PreviewSubId(null)}
                    onWriteFeedback={startWriteFeedback}
                    getRemindCooldownMs={getRemindCooldownMs}
                    onRemindSub={(sub) => {
                      if (getRemindCooldownMs(sub.id) > 0) return;
                      remind([sub.id]);
                      toast.success(`已发送催办邮件给 ${sub.name}`);
                    }}
                    onRemind={(ids) => {
                      remind(ids);
                      toast.success(`已发送催办邮件给 ${ids.length} 名下属`);
                    }}
                  />
                </div>
                {reportVersionActive && (
                  <section
                    className={`rounded-2xl border border-border bg-card overflow-hidden ${
                      detailPanelExpanded
                        ? "absolute inset-0 z-20 h-[calc(100vh-20rem)] min-h-[520px] shadow-[0_24px_70px_rgba(15,23,42,0.16)]"
                        : "h-[calc(100vh-20rem)] min-h-[520px] min-w-[420px] flex-1 resize-x"
                    }`}
                  >
                    {selectedSub ? (
                      <SubordinatePerformancePanel
                        sub={selectedSub}
                        submittedFeedback={submittedFeedbackBySubId[selectedSub.id]}
                        onWriteFeedback={() => startWriteFeedback(selectedSub)}
                        remindCooldownMs={getRemindCooldownMs(selectedSub.id)}
                        onRemind={() => {
                          if (getRemindCooldownMs(selectedSub.id) > 0) return;
                          remind([selectedSub.id]);
                          toast.success(`已发送催办邮件给 ${selectedSub.name}`);
                        }}
                        onBackToTeam={() => {
                          setSelectedSub(null);
                          setDetailPanelExpanded(false);
                        }}
                        showExpandButton
                        expanded={detailPanelExpanded}
                        onToggleExpanded={() => setDetailPanelExpanded((expanded) => !expanded)}
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center p-8">
                        <p className="text-sm text-muted-foreground">从左侧组织架构选择成员查看详情</p>
                      </div>
                    )}
                  </section>
                )}
              </div>
            </div>
          )}
        </main>

        {personalDetailOpen && (
          <PersonalPerformanceDrawer
              focusMetricsSignal={personalMetricFocusTick}
              side={personalDetailSide}
              onClose={() => setPersonalDetailOpen(false)}
            />
        )}

        {managerOrgVersion !== "v3" && managerOrgVersion !== "v4" && aiPanelMode !== "closed" && (
          <aside className={aiPanelClass} style={aiPanelStyle} data-ai-panel>
            {aiWorkContext === "personal_report" ? (
              <PersonalReportWritingPanel
                activeMode={personalReportWorkMode}
                onModeChange={(mode) => {
                  setPersonalReportWorkMode(mode);
                  if (mode === "ai" && !["personal_scoring", "personal_generated", "personal_editing"].includes(aiMode)) {
                    setAiMode("personal_scoring");
                  }
                }}
                onSubmitted={(submittedReport) => {
                  submitPersonalMonthlyReport(submittedReport);
                  toast.success("月度汇报已录入系统");
                }}
                aiContent={
                  <AIAssistant
                    mode={aiMode}
                    setMode={setAiMode}
                    selectedSub={selectedSub}
                    subs={subs}
                    activeModule={activeModule}
                    scores={scores}
                    setScores={setScores}
                    panelMode={aiPanelMode}
                    onSelectSub={setSelectedSub}
                    onToggleFloating={() => setAiPanelMode((mode) => mode === "floating" ? "docked" : "floating")}
                    onToggleFullscreen={() => setAiPanelMode((mode) => mode === "fullscreen" ? "docked" : "fullscreen")}
                    onClosePanel={() => {
                      setAiPanelMode("closed");
                      setAiWorkContext(null);
                    }}
                    onFeedbackSubmitted={submitSupervisorFeedback}
                    onPersonalConfirmed={(submittedReport) => {
                      if (submittedReport) submitPersonalMonthlyReport(submittedReport);
                    }}
                    onStartFloatingDrag={startAiPanelDrag}
                    onStartPersonalReport={startWriteReport}
                    onStartFeedback={startWriteFeedback}
                    onExitWorkContext={() => setAiWorkContext(null)}
                  />
                }
              />
            ) : aiWorkContext === "feedback" ? (
              <FeedbackWritingPanel
                selectedSub={selectedSub}
                activeMode={feedbackWorkMode}
                onModeChange={(mode) => {
                  setFeedbackWorkMode(mode);
                  if (mode === "ai" && selectedSub) {
                    setAiMode("scoring");
                  }
                }}
                onSubmitted={submitSupervisorFeedbackAndAdvance}
                aiContent={
                  <AIAssistant
                    mode={aiMode}
                    setMode={setAiMode}
                    selectedSub={selectedSub}
                    subs={subs}
                    activeModule={activeModule}
                    scores={scores}
                    setScores={setScores}
                    panelMode={aiPanelMode}
                    onSelectSub={setSelectedSub}
                    onToggleFloating={() => setAiPanelMode((mode) => mode === "floating" ? "docked" : "floating")}
                    onToggleFullscreen={() => setAiPanelMode((mode) => mode === "fullscreen" ? "docked" : "fullscreen")}
                    onClosePanel={() => {
                      setAiPanelMode("closed");
                      setAiWorkContext(null);
                    }}
                    onFeedbackSubmitted={submitSupervisorFeedbackAndAdvance}
                    onPersonalConfirmed={(submittedReport) => {
                      if (submittedReport) submitPersonalMonthlyReport(submittedReport);
                    }}
                    onStartFloatingDrag={startAiPanelDrag}
                    onStartPersonalReport={startWriteReport}
                    onStartFeedback={startWriteFeedback}
                    onExitWorkContext={() => setAiWorkContext(null)}
                  />
                }
              />
            ) : (
              <AIAssistant
                mode={aiMode}
                setMode={setAiMode}
                selectedSub={selectedSub}
                subs={subs}
                activeModule={activeModule}
                scores={scores}
                setScores={setScores}
                panelMode={aiPanelMode}
                onSelectSub={setSelectedSub}
                onToggleFloating={() => setAiPanelMode((mode) => mode === "floating" ? "docked" : "floating")}
                onToggleFullscreen={() => setAiPanelMode((mode) => mode === "fullscreen" ? "docked" : "fullscreen")}
                onClosePanel={() => {
                  setAiPanelMode("closed");
                  setAiWorkContext(null);
                }}
                onFeedbackSubmitted={submitSupervisorFeedback}
                onPersonalConfirmed={(submittedReport) => {
                  if (submittedReport) submitPersonalMonthlyReport(submittedReport);
                }}
                onStartFloatingDrag={startAiPanelDrag}
                onStartPersonalReport={startWriteReport}
                onStartFeedback={startWriteFeedback}
                onExitWorkContext={() => setAiWorkContext(null)}
              />
            )}
          </aside>
        )}
        {managerOrgVersion !== "v3" && managerOrgVersion !== "v4" && aiPanelMode === "closed" && (
          <button
            type="button"
            onClick={() => setAiPanelMode("docked")}
            className="fixed bottom-6 right-6 z-40 flex items-center gap-2 rounded-2xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-[0_18px_45px_rgba(15,23,42,0.16)] transition hover:bg-primary/90"
          >
            <Sparkles className="h-4 w-4" />
            打开 AI 助理
          </button>
        )}
      </div>
      {monthlyGuideOpen && (
        <MonthlyReportGuideDialog
          initialGuide={monthlyGuideKind}
          cycle={getReportGuideCycle(versionOneReportTab)}
          onClose={closeMonthlyGuide}
        />
      )}
    </div>
  );
}

function MonthlyReportGuideDialog({
  initialGuide = "feedback",
  cycle = "monthly",
  onClose,
}: {
  initialGuide?: MonthlyGuideKind;
  cycle?: ReportGuideCycle;
  onClose: () => void;
}) {
  const [activeGuideKind, setActiveGuideKind] = useState<MonthlyGuideKind>(initialGuide);
  const [activeStep, setActiveStep] = useState(0);
  const [manualInteracted, setManualInteracted] = useState(false);
  const guideSet = cycle === "midyear" ? MIDYEAR_GUIDES : MONTHLY_GUIDES;
  const guide = guideSet[activeGuideKind];
  const guideSteps = guide.steps;
  const current = guideSteps[activeStep];
  const CurrentIcon = current.icon;

  useEffect(() => {
    if (manualInteracted) return;
    const timer = window.setInterval(() => {
      setActiveStep((step) => (step + 1) % guideSteps.length);
    }, 3000);
    return () => window.clearInterval(timer);
  }, [manualInteracted, guideSteps.length]);

  const chooseStep = (index: number) => {
    setManualInteracted(true);
    setActiveStep(index);
  };

  const goStep = (direction: -1 | 1) => {
    setManualInteracted(true);
    setActiveStep((step) => Math.min(Math.max(0, step + direction), guideSteps.length - 1));
  };

  const switchGuide = (kind: MonthlyGuideKind) => {
    setActiveGuideKind(kind);
    setManualInteracted(true);
    setActiveStep(0);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-slate-950/50 px-4 py-5 backdrop-blur-[5px]">
      <div className={`pointer-events-none absolute -left-16 top-10 h-72 w-72 rounded-full bg-gradient-to-br ${current.tone} opacity-24 blur-3xl animate-pulse`} />
      <div className="pointer-events-none absolute bottom-[-80px] right-[-60px] h-[420px] w-[420px] rounded-full bg-primary/20 blur-3xl animate-pulse [animation-delay:900ms]" />
      <div className="pointer-events-none absolute left-[18%] top-[16%] h-2 w-2 rounded-full bg-cyan-200 shadow-[0_0_30px_8px_rgba(125,211,252,0.45)] animate-ping" />

      <section className="relative grid max-h-[92vh] w-full max-w-[1240px] grid-cols-1 overflow-hidden rounded-[30px] border border-white/55 bg-white/80 shadow-[0_36px_120px_rgba(15,23,42,0.32)] backdrop-blur-2xl md:grid-cols-[248px_minmax(0,1fr)]">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 z-20 flex h-10 w-10 items-center justify-center rounded-full border border-white/35 bg-slate-950/70 text-white shadow-lg backdrop-blur-xl transition hover:bg-slate-950"
          aria-label={`关闭${guide.title}`}
        >
          <X className="h-4 w-4" />
        </button>

        <aside className="hidden min-h-[720px] border-r border-white/60 bg-white/42 px-4 py-6 backdrop-blur-xl md:block">
          <p className="px-2 text-xs font-black uppercase tracking-[0.22em] text-slate-400">Guide Steps</p>
          <div className="mt-4 space-y-3">
            {guideSteps.map((step, index) => {
              const StepIcon = step.icon;
              const active = index === activeStep;
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => chooseStep(index)}
                  className={`group relative flex w-full items-center gap-3 overflow-hidden rounded-[20px] px-3.5 py-3.5 text-left transition ${
                    active
                      ? "bg-primary text-white shadow-[0_18px_40px_rgba(37,99,235,0.22)]"
                      : "border border-white/70 bg-white/56 text-slate-600 hover:bg-white hover:text-slate-950"
                  }`}
                >
                  {active && <span className={`absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r ${step.tone}`} />}
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-black ${
                    active ? "bg-white/20 text-white" : "bg-slate-100 text-slate-400 group-hover:bg-white"
                  }`}>
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-black">{step.title}</span>
                    <span className={`mt-0.5 block truncate text-[11px] font-semibold ${
                      active ? "text-white/78" : "text-slate-400"
                    }`}>
                      {step.subtitle}
                    </span>
                  </span>
                  <StepIcon className="h-4 w-4 shrink-0 opacity-75" />
                </button>
              );
            })}
          </div>
        </aside>

        <div className="min-h-0 min-w-0 overflow-y-auto bg-[radial-gradient(circle_at_12%_0%,rgba(37,99,235,0.14),transparent_28%),radial-gradient(circle_at_100%_18%,rgba(34,211,238,0.14),transparent_25%),linear-gradient(135deg,rgba(248,250,252,0.92),rgba(239,246,255,0.9)_52%,rgba(255,255,255,0.94))] p-4 md:p-6">
          <div className="mx-auto max-w-5xl">
            <div className="mb-4 flex items-start justify-between gap-4 md:hidden">
              <div className="flex items-center gap-3">
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-white">
                  <BookOpenText className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-lg font-black text-slate-950">{guide.title}</p>
                  <p className="text-xs font-semibold text-slate-500">{guide.subtitle}</p>
                </div>
              </div>
            </div>

            <div className="mb-4 flex gap-2 overflow-x-auto pb-1 md:hidden">
              {guideSteps.map((step, index) => (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => chooseStep(index)}
                  className={`h-9 shrink-0 rounded-full px-4 text-xs font-black transition ${
                    index === activeStep
                      ? "bg-primary text-white"
                      : "bg-white/75 text-slate-500 ring-1 ring-white/80"
                  }`}
                >
                  {index + 1}. {step.title}
                </button>
              ))}
            </div>

            <section className="relative overflow-hidden rounded-[28px] border border-white/70 bg-white/70 shadow-[0_28px_86px_rgba(15,23,42,0.14)] backdrop-blur-2xl">
              <div className="pointer-events-none absolute right-10 top-12 h-20 w-20 rounded-full border border-cyan-200/60 bg-cyan-100/20 animate-pulse" />
              <div className="relative flex flex-col gap-4 border-b border-white/70 bg-white/42 px-5 py-5 backdrop-blur-xl md:flex-row md:items-center md:justify-between md:px-7">
                <div className="flex items-center gap-4">
                  <div className={`relative grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${current.tone} text-white shadow-[0_16px_36px_rgba(37,99,235,0.18)]`}>
                    <CurrentIcon className="h-6 w-6" />
                    <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-white shadow-[0_0_18px_rgba(255,255,255,0.9)]" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-2xl font-black tracking-tight text-slate-950">{guide.title}</p>
                      <span className={`rounded-full bg-gradient-to-r ${current.tone} px-2.5 py-1 text-[11px] font-black text-white shadow-sm`}>
                        {current.badge}
                      </span>
                    </div>
                    <p className="mt-1 text-sm font-bold text-slate-600">{guide.title} · {current.title} · {current.subtitle}</p>
                  </div>
                </div>
                <div className="flex shrink-0 rounded-2xl border border-white/70 bg-white/70 p-1 shadow-sm">
                  {(["summary", "feedback"] as const).map((kind) => {
                    const active = activeGuideKind === kind;
                    return (
                      <button
                        key={kind}
                        type="button"
                        onClick={() => switchGuide(kind)}
                        className={`h-9 rounded-xl px-3 text-xs font-black transition ${
                          active ? "bg-primary text-white shadow-sm" : "text-slate-500 hover:bg-white hover:text-slate-950"
                        }`}
                      >
                        {guideSet[kind].shortTitle}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="relative p-4 md:p-6">
                <GuideInstructionStage
                  current={current}
                  activeStep={activeStep}
                  guideKind={activeGuideKind}
                  cycle={cycle}
                />
              </div>

              <div className="relative flex items-center justify-between gap-3 border-t border-white/65 bg-white/42 px-5 py-4 backdrop-blur-xl md:px-7">
                <button
                  type="button"
                  onClick={() => goStep(-1)}
                  disabled={activeStep === 0}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/80 bg-white/75 px-4 text-sm font-black text-slate-700 shadow-sm backdrop-blur-xl transition hover:bg-white disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <ChevronLeft className="h-4 w-4" />
                  上一步
                </button>
                <button
                  type="button"
                  onClick={() => activeStep === guideSteps.length - 1 ? onClose() : goStep(1)}
                  className={`inline-flex h-10 items-center gap-2 rounded-xl bg-gradient-to-r ${current.tone} px-5 text-sm font-black text-white shadow-[0_12px_30px_rgba(15,23,42,0.16)] transition hover:brightness-105`}
                >
                  {activeStep === guideSteps.length - 1 ? "收起指南" : "下一步"}
                  {activeStep === guideSteps.length - 1 ? <Check className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              </div>
            </section>
          </div>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function GuideInstructionStage({
  current,
  activeStep,
  guideKind,
  cycle,
}: {
  current: GuideStep;
  activeStep: number;
  guideKind: MonthlyGuideKind;
  cycle: ReportGuideCycle;
}) {
  return (
    <div className="rounded-[26px] border border-white/80 bg-white/78 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_18px_50px_rgba(15,23,42,0.1)] backdrop-blur-xl md:p-5">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_44px_minmax(360px,0.82fr)]">
        <GuidePrototypeCanvas
          activeStep={activeStep}
          guideKind={guideKind}
          cycle={cycle}
          stepId={current.id}
        />
        <div className="hidden items-center justify-center xl:flex">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-slate-200 text-slate-500 shadow-inner">
            <ChevronRight className="h-7 w-7" />
          </span>
        </div>
        <GuideContentPanel current={current} />
      </div>
    </div>
  );
}

function GuideContentPanel({ current }: { current: GuideStep }) {
  return (
    <div className="rounded-[22px] border border-slate-200 bg-white p-4 shadow-[0_14px_38px_rgba(15,23,42,0.08)]">
      <div className="mb-3 flex items-center gap-2">
        <span className={`h-2 w-8 rounded-full bg-gradient-to-r ${current.tone}`} />
        <p className="text-sm font-black text-slate-950">{current.title}</p>
      </div>
      <div className="space-y-3">
        {current.sections.map((section) => (
          <article key={section.title} className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3">
            <p className="text-sm font-black text-slate-950">{section.title}</p>
            <div className="mt-2 space-y-1.5">
              {section.items.map((item) => (
                <p key={item} className="flex gap-2 text-xs font-semibold leading-5 text-slate-600">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/75" />
                  <span>{item}</span>
                </p>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function GuidePrototypeCanvas({
  activeStep,
  guideKind,
  cycle,
  stepId,
}: {
  activeStep: number;
  guideKind: MonthlyGuideKind;
  cycle: ReportGuideCycle;
  stepId: string;
}) {
  const isFeedback = guideKind === "feedback";
  const isMidyear = cycle === "midyear";
  const title = isFeedback
    ? `${isMidyear ? "年中/年度绩效反馈指引" : "月度绩效反馈指引"}`
    : `${isMidyear ? "年中/年度绩效总结指引" : "月度绩效总结指引"}`;
  const labels = isFeedback
    ? (isMidyear
      ? ["绩效评分", "工作亮点", "存在不足", "后续改进建议", "8Q+TEL", "综合能力", "发展趋势"]
      : ["绩效评分", "工作亮点", "存在不足", "下月重点工作"])
    : (isMidyear
      ? ["核心KPI及关键工作达成自评", "主要贡献及亮点", "不足及遗憾"]
      : ["核心KPI及关键工作达成自评", "综合汇报"]);

  const focusIndex = Math.min(activeStep, labels.length - 1);
  return (
    <div className="overflow-hidden rounded-[22px] border border-primary/15 bg-primary-soft/70 p-4 shadow-inner">
      <p className="mb-4 text-lg font-black text-primary">{title}</p>
      {isFeedback && isMidyear && stepId.includes("quality") ? (
        <QualityPrototype focus={stepId} />
      ) : (
        <div className="space-y-3">
          {isFeedback ? <FeedbackScorePrototype active={focusIndex === 0} isMidyear={isMidyear} /> : <SummaryScorePrototype isMidyear={isMidyear} active={focusIndex === 0} />}
          {labels.slice(1).map((label, index) => (
            <GuidePrototypeBlock
              key={label}
              index={index + 2}
              label={label}
              active={focusIndex === index + 1}
              muted={focusIndex !== index + 1}
              lines={prototypeLines(label, isMidyear, isFeedback)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function GuidePrototypeBlock({
  index,
  label,
  active,
  muted,
  lines,
}: {
  index: number;
  label: string;
  active: boolean;
  muted: boolean;
  lines: string[];
}) {
  return (
    <section className={`relative rounded-xl border bg-white p-3 pt-5 transition ${active ? "border-primary opacity-100" : "border-primary/15 opacity-35"} ${muted ? "grayscale" : ""}`}>
      <span className={`absolute -left-2 -top-2 grid h-7 w-7 place-items-center rounded-full text-xs font-black ring-2 ring-white ${active ? "bg-primary text-white" : "bg-primary/10 text-primary"}`}>
        {index}
      </span>
      <span className={`absolute left-5 -top-3 rounded-sm px-5 py-2 text-sm font-black ${active ? "bg-primary text-white" : "bg-primary/10 text-primary"}`}>
        {label}
      </span>
      <div className="mt-4 space-y-2">
        {lines.map((line) => (
          <p key={line} className="text-sm font-bold leading-6 text-primary">{line}</p>
        ))}
      </div>
    </section>
  );
}

function SummaryScorePrototype({ isMidyear, active }: { isMidyear: boolean; active: boolean }) {
  return (
    <section className={`relative rounded-xl border bg-white p-3 pt-8 transition ${active ? "border-primary opacity-100" : "border-primary/15 opacity-35 grayscale"}`}>
      <span className={`absolute -left-2 -top-2 grid h-7 w-7 place-items-center rounded-full text-xs font-black ring-2 ring-white ${active ? "bg-primary text-white" : "bg-primary/10 text-primary"}`}>1</span>
      <span className={`absolute left-5 -top-3 rounded-sm px-5 py-2 text-sm font-black ${active ? "bg-primary text-white" : "bg-primary/10 text-primary"}`}>核心KPI及关键工作达成自评</span>
      <div className="ml-auto mb-2 w-max rounded bg-white px-3 py-1 text-sm font-black text-primary">自评总分：XXXX</div>
      <GuideMiniTable
        rows={[
          ["核心KPI", "权重", "进展自评", "自评分"],
          ["年初制定", "年初制定", isMidyear ? "下属年中/年度填写" : "每月5日前填写", isMidyear ? "下属年中/年度填写" : "每月5日前填写"],
          ["关键工作", "进展自评", "自评分", ""],
          ["年初制定", isMidyear ? "下属年中/年度填写" : "每月5日前填写", isMidyear ? "下属年中/年度填写" : "每月5日前填写", ""],
        ]}
      />
    </section>
  );
}

function FeedbackScorePrototype({ active, isMidyear }: { active: boolean; isMidyear: boolean }) {
  return (
    <section className={`relative rounded-xl border bg-white p-3 pt-8 transition ${active ? "border-primary opacity-100" : "border-primary/15 opacity-35 grayscale"}`}>
      <span className={`absolute -left-2 -top-2 grid h-7 w-7 place-items-center rounded-full text-xs font-black ring-2 ring-white ${active ? "bg-primary text-white" : "bg-primary/10 text-primary"}`}>1</span>
      <span className={`absolute left-5 -top-3 rounded-sm px-5 py-2 text-sm font-black ${active ? "bg-primary text-white" : "bg-primary/10 text-primary"}`}>绩效评分</span>
      <div className="ml-auto mb-2 w-max rounded bg-white px-3 py-1 text-sm font-black text-primary">综合评分：XX(上级反馈)</div>
      <GuideMiniTable
        rows={[
          ["核心KPI", "权重", "达成", "核心KPI评分"],
          [isMidyear ? "下属年初制定" : "下属年初制定", isMidyear ? "下属年初制定" : "下属年初制定", "下属填写", "上级反馈"],
          ["关键工作", "达成", "关键工作评分", ""],
          [isMidyear ? "下属年初制定" : "下属年初制定", "下属填写", "上级反馈", ""],
        ]}
      />
    </section>
  );
}

function QualityPrototype({ focus }: { focus: string }) {
  const rows = ["IQ（智商）", "EQ（情商）", "PQ（专业商）", "EEQ（经验商）", "AQ（逆商）", "AAQ（态度商）", "LQ（忠诚商）", "SQ（资源商）", "T（想事）", "E（做事）", "L（带队伍）"];
  return (
    <div className="space-y-3">
      <section className={`relative rounded-xl border bg-white p-3 pt-8 ${focus.includes("8q") ? "border-primary" : "border-primary/15 opacity-35 grayscale"}`}>
        <span className="absolute -left-2 -top-2 grid h-7 w-7 place-items-center rounded-full bg-primary text-xs font-black text-white ring-2 ring-white">5</span>
        <span className="absolute left-5 -top-3 rounded-sm bg-primary px-8 py-2 text-sm font-black text-white">8Q+TEL</span>
        <div className="grid grid-cols-[1fr_1fr_1.6fr] border border-primary/20 text-xs font-bold text-slate-700">
          <div className="bg-primary-soft p-2 text-primary">评价维度</div>
          <div className="bg-primary-soft p-2 text-primary">评价档位</div>
          <div className="bg-primary-soft p-2 text-primary">优势项标签</div>
          {rows.map((row) => (
            <>
              <div key={`${row}-name`} className="border-t border-slate-200 p-1.5">{row}</div>
              <div key={`${row}-rate`} className="border-t border-slate-200 p-1.5 text-primary">上级评价</div>
              <div key={`${row}-tag`} className="border-t border-slate-200 p-1.5">□ 反应敏捷　□ 人际理解</div>
            </>
          ))}
          <div className="col-span-3 border-t border-primary/20 p-2 text-primary">综合评估：XX（上级评价）</div>
        </div>
      </section>
      <GuidePrototypeBlock index={6} label="综合能力" active={focus.includes("ability")} muted={!focus.includes("ability")} lines={["□ 超越胜任　□ 完全胜任　□ 基本胜任　□ 继续观察"]} />
      <GuidePrototypeBlock index={7} label="发展趋势" active={focus.includes("trend")} muted={!focus.includes("trend")} lines={["□ 箭头向上 ↑　□ 箭头持平 >　□ 箭头向下 ↓"]} />
    </div>
  );
}

function GuideMiniTable({ rows }: { rows: string[][] }) {
  return (
    <div className="overflow-hidden rounded-sm border border-primary/20">
      {rows.map((row, index) => (
        <div key={index} className="grid grid-cols-4 text-center text-xs font-bold text-slate-700">
          {row.map((cell, cellIndex) => (
            <div key={`${index}-${cellIndex}`} className={`${index % 2 === 0 ? "bg-primary-soft text-primary" : "bg-white text-slate-400"} border-b border-r border-white px-2 py-2`}>
              {cell}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function prototypeLines(label: string, isMidyear: boolean, isFeedback: boolean) {
  if (!isFeedback && label === "主要贡献及亮点") return ["• 新价值：", "• 新贡献：", "• 新提升：", "• 新创新："];
  if (!isFeedback && label === "不足及遗憾") return ["• 第一点：", "• 第二点：", "• 第三点："];
  if (!isFeedback) return ["一、重点工作进展：XXXX", "二、存在不足：XXXXXXXX", "三、下月工作计划：XXXX"];
  if (label === "工作亮点") return ["上级反馈"];
  if (label === "存在不足") return ["上级反馈（重点）"];
  if (label === "下月重点工作" || label === "后续改进建议") return ["上级反馈（重点）"];
  return isMidyear ? ["上级反馈"] : ["上级反馈"];
}

type VersionFourAiWorkspaceProps = {
  demoRole?: VersionFourDemoRole;
  activeTab: ReportTabKey;
  subs: Subordinate[];
  submittedFeedbackBySubId: Record<string, SubmittedFeedback>;
  submittedPersonalReports: Record<string, SubmittedPersonalMonthlyReport>;
  personalReportStatus: PersonalMonthlyReportStatus;
  onSelectSub: (sub: Subordinate | null) => void;
  onPersonalSubmitted: (report: SubmittedPersonalMonthlyReport) => void;
  onFeedbackSubmitted: (subId: string, feedback: SubmittedFeedback) => void;
  getRemindCooldownMs: (id: string) => number;
  onRemindSub: (sub: Subordinate) => void;
  onOpenMonthlyGuide: (kind?: MonthlyGuideKind) => void;
};

const VERSION_FOUR_PERSONAL_DRAFT_KEY = "performance-hub-v4-personal-draft";
const VERSION_FOUR_FEEDBACK_DRAFT_KEY = "performance-hub-v4-feedback-drafts";

type VersionFourAssistantPrompt = {
  text: string;
  kind:
    | "guide"
    | "feedback_guide"
    | "feedback_guide_open"
    | "feedback_structure"
    | "personal_draft"
    | "feedback_draft"
    | "missing_reports"
    | "general";
};

type VersionFourPreviewSubmission =
  | { kind: "personal"; report: PersonalReport }
  | { kind: "feedback"; sub: Subordinate; draft: FeedbackDraft; scoreMap: Record<string, number> };

type VersionFourBatchFeedbackPhase = "confirm" | "generating" | "ready" | "detail" | "complete";

type VersionFourBatchFeedbackItem = {
  sub: Subordinate;
  draft: FeedbackDraft;
  scoreMap: Record<string, number>;
  status: "pending" | "generating" | "confirmed";
  emailSent: boolean;
};

function buildVersionFourAssistantHome({
  demoRole,
  activeTab,
  activeMode,
  activeSub,
  personalReportStatus,
  pendingFeedbackCount,
  pendingSubmitCount,
}: {
  demoRole: VersionFourDemoRole;
  activeTab: ReportTabKey;
  activeMode: "report" | "feedback";
  activeSub: Subordinate | null;
  personalReportStatus: PersonalMonthlyReportStatus;
  pendingFeedbackCount: number;
  pendingSubmitCount: number;
}) {
  const cycle = getReportCycleCopy(activeTab);
  const roleLabel =
    demoRole === "new_manager" ? "新晋管理者" :
    demoRole === "new_employee" ? "新员工" :
    demoRole === "employee" ? "普通员工" : "管理者";
  const taskLine = activeMode === "feedback" && activeSub
    ? `当前聚焦 ${activeSub.name} 的${cycle.feedbackName}，可以生成反馈初稿、查看评分依据或切换其他下属。`
    : personalReportStatus === "pending_submit"
      ? `当前待完成${cycle.personalReportName}，可以自主填写，也可以由 AI 基于${cycle.sourceText}生成初稿。`
      : `您的${cycle.personalReportName}已提交，可以继续处理下属反馈和催办事项。`;
  return {
    intro: `${roleLabel}视角 · ${cycle.periodLabel}\n${taskLine}\n待反馈 ${pendingFeedbackCount} 人，待提交 ${pendingSubmitCount} 人。`,
  };
}

function buildVersionFourAssistantPrompts({
  demoRole,
  activeTab,
  activeMode,
  activeSub,
}: {
  demoRole: VersionFourDemoRole;
  activeTab: ReportTabKey;
  activeMode: "report" | "feedback";
  activeSub: Subordinate | null;
}): VersionFourAssistantPrompt[] {
  const cycle = getReportCycleCopy(activeTab);
  if (activeMode === "feedback") {
    return [
      { kind: "feedback_draft", text: activeSub ? `生成${activeSub.name}${cycle.feedbackName}初稿` : `生成下属${cycle.feedbackName}初稿` },
      { kind: "feedback_structure", text: `${cycle.feedbackName}应该怎么写？` },
      { kind: "feedback_guide", text: `${cycle.feedbackName}指南` },
    ];
  }
  return [
    { kind: "personal_draft", text: `帮我生成${cycle.personalReportName}初稿` },
    { kind: demoRole === "new_manager" ? "feedback_guide_open" : "guide", text: `${cycle.guideButtonText}` },
    { kind: "missing_reports", text: "本月哪些下属还未提交汇报？" },
  ];
}

function appendVersionFourDetailHint(text: string) {
  return `${text}\n\n如需查看明细，可以在左侧任务区切换到对应下属或待提交名单。`;
}

function shouldShowVersionFourFeedbackHistoryAction(
  message: { role: "assistant" | "user"; text: string },
  activeMode: "report" | "feedback",
) {
  return activeMode === "feedback" && /反馈|评分|历史|总结/.test(message.text);
}

function buildVersionFourAssistantAnswer(
  text: string,
  {
    activeTab,
    activeMode,
    activeSub,
    pendingFeedbackSubs,
    pendingSubmitSubs,
  }: {
    activeTab: ReportTabKey;
    activeMode: "report" | "feedback";
    activeSub: Subordinate | null;
    pendingFeedbackSubs: Subordinate[];
    pendingSubmitSubs: Subordinate[];
  },
) {
  const cycle = getReportCycleCopy(activeTab);
  if (/未提交|待提交|催办/.test(text)) {
    return appendVersionFourDetailHint(
      pendingSubmitSubs.length
        ? `当前还有 ${pendingSubmitSubs.length} 位下属未提交${cycle.submittedSummaryName}，建议先按直接下属优先级催办。`
        : `当前没有未提交${cycle.submittedSummaryName}的下属。`,
    );
  }
  if (/反馈|评分/.test(text) || activeMode === "feedback") {
    const target = activeSub?.name ?? (pendingFeedbackSubs[0]?.name ?? "下属");
    return `${target}的${cycle.feedbackName}建议围绕结果达成、关键贡献、短板风险和${cycle.nextFocusLabel}展开，并用具体 KPI 或项目事实支撑评分。`;
  }
  return `可以基于${cycle.sourceText}梳理${cycle.personalReportName}：先写核心进展，再写不足反思，最后落到${cycle.nextFocusLabel}。`;
}

function VersionFourAiWorkspace({
  demoRole = "manager",
  activeTab,
  subs,
  submittedFeedbackBySubId,
  submittedPersonalReports,
  personalReportStatus,
  onSelectSub,
  onPersonalSubmitted,
  onFeedbackSubmitted,
  getRemindCooldownMs,
  onRemindSub,
  onOpenMonthlyGuide,
}: VersionFourAiWorkspaceProps) {
  const [activeTargetId, setActiveTargetId] = useState<VersionFourTargetId>("self");
  const [drawerTargetId, setDrawerTargetId] = useState<VersionFourTargetId | null>(null);
  const [drawerExpanded, setDrawerExpanded] = useState(false);
  const [chatInput, setChatInput] = useState("");
  const [writeMode, setWriteMode] = useState<VersionFourWriteMode>("choice");
  const [modeChoiceVisible, setModeChoiceVisible] = useState(false);
  const [newUserGuideVisible, setNewUserGuideVisible] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [assistantHistoryOpen, setAssistantHistoryOpen] = useState(false);
  const [pendingSubmitListVisible, setPendingSubmitListVisible] = useState(false);
  const [feedbackPickerVisible, setFeedbackPickerVisible] = useState(false);
  const [revisionCount, setRevisionCount] = useState(0);
  const [subGroupFilter, setSubGroupFilter] = useState<VersionFourSubGroupFilter>("direct");
  const [subStatusFilter, setSubStatusFilter] = useState<OrgStatusFilter>("pending_feedback");
  const [messages, setMessages] = useState<Array<{ id: string; role: "assistant" | "user"; text: string }>>([]);
  const [savedPersonalDraft, setSavedPersonalDraft] = useState<PersonalReport | null>(null);
  const [savedFeedbackDraftBySubId, setSavedFeedbackDraftBySubId] = useState<Record<string, { draft: FeedbackDraft; scoreMap: Record<string, number> }>>({});
  const [previewSubmission, setPreviewSubmission] = useState<VersionFourPreviewSubmission | null>(null);
  const [emailDraft, setEmailDraft] = useState<FeedbackEmailDraft | null>(null);
  const [emailSubName, setEmailSubName] = useState("");
  const [submittingPreview, setSubmittingPreview] = useState(false);
  const [batchFeedbackPhase, setBatchFeedbackPhase] = useState<VersionFourBatchFeedbackPhase | null>(null);
  const [batchFeedbackItems, setBatchFeedbackItems] = useState<VersionFourBatchFeedbackItem[]>([]);
  const [activeBatchSubId, setActiveBatchSubId] = useState<string | null>(null);
  const [batchPreviewOpen, setBatchPreviewOpen] = useState(false);
  const [batchOptimizationSubId, setBatchOptimizationSubId] = useState<string | null>(null);
  const [generationGuideConfirm, setGenerationGuideConfirm] = useState<"personal" | "feedback" | null>(null);
  const [midyearSummarySubId, setMidyearSummarySubId] = useState<string | null>(null);
  const cycle = getReportCycleCopy(activeTab);
  const roleCanReviewSubs = demoRole === "manager" || demoRole === "new_manager";
  const pendingFeedbackSubs = subs.filter((sub) => sub.status === "pending_feedback");
  const pendingFeedbackDirectSubs = pendingFeedbackSubs.filter((sub) => sub.type === "direct");
  const pendingFeedbackIndirectSubs = pendingFeedbackSubs.filter((sub) => sub.type === "indirect");
  const pendingSubmitSubs = subs.filter((sub) => sub.status === "not_submitted" || sub.status === "reminded");
  const pendingSubmitDirectSubs = pendingSubmitSubs.filter((sub) => sub.type === "direct");
  const pendingSubmitIndirectSubs = pendingSubmitSubs.filter((sub) => sub.type === "indirect");
  const groupedSubs = subs.filter((sub) => sub.type === subGroupFilter);
  const visibleSubs = roleCanReviewSubs ? filterAndSortOrgSubs(groupedSubs, subStatusFilter) : [];
  const groupOptions: Array<{ key: VersionFourSubGroupFilter; label: string; count: number }> = [
    { key: "direct", label: "直接下属", count: subs.filter((sub) => sub.type === "direct").length },
    { key: "indirect", label: "间接下属", count: subs.filter((sub) => sub.type === "indirect").length },
  ];
  const statusCountByFilter = (filter: OrgStatusFilter) => filterAndSortOrgSubs(groupedSubs, filter).length;
  const activeSub = activeTargetId === "self" ? null : subs.find((sub) => sub.id === activeTargetId) ?? null;
  const activeMode: "report" | "feedback" = activeTargetId === "self" ? "report" : "feedback";
  const feedbackScoreMap = getDefaultFeedbackScores();
  const feedbackDraft = activeSub
    ? cycle.isMidyear
      ? buildMidyearManagerFeedbackDraft(SAMPLE_SUB_DATA_BY_ID[activeSub.id] ?? null, activeSub.name, computeDirectFeedbackScore(feedbackScoreMap), revisionCount > 0)
      : buildManagerFeedbackDraft(SAMPLE_SUB_DATA_BY_ID[activeSub.id] ?? null, activeSub.name, computeDirectFeedbackScore(feedbackScoreMap), revisionCount > 0)
    : null;
  const personalDraft = cycle.isMidyear ? buildMidyearPersonalReport() : buildPersonalReport(
    Object.fromEntries(PERSONAL_ITEMS.map((item) => [item.id, item.aiNote])),
    Object.fromEntries(PERSONAL_ITEMS.map((item) => [item.id, getDefaultPersonalSelfScore(item)])),
  );
  const submittedPersonalReport = submittedPersonalReports[cycle.periodKey];
  const assistantHome = buildVersionFourAssistantHome({
    demoRole,
    activeTab,
    activeMode,
    activeSub,
    personalReportStatus,
    pendingFeedbackCount: pendingFeedbackDirectSubs.length,
    pendingSubmitCount: pendingSubmitSubs.length,
  });
  const assistantPrompts = buildVersionFourAssistantPrompts({ demoRole, activeTab, activeMode, activeSub });
  const latestAssistantMessageId = [...messages].reverse().find((message) => message.role === "assistant")?.id;

  useEffect(() => {
    try {
      const personalRaw = window.localStorage.getItem(VERSION_FOUR_PERSONAL_DRAFT_KEY);
      if (personalRaw) setSavedPersonalDraft(JSON.parse(personalRaw));
      const feedbackRaw = window.localStorage.getItem(VERSION_FOUR_FEEDBACK_DRAFT_KEY);
      if (feedbackRaw) setSavedFeedbackDraftBySubId(JSON.parse(feedbackRaw));
    } catch {
      // Draft persistence is best-effort for the demo.
    }
  }, []);

  useEffect(() => {
    try {
      if ((demoRole === "new_employee" || demoRole === "new_manager") && window.localStorage.getItem("performance-hub-v4-new-user-guide-seen") !== "1") {
        setNewUserGuideVisible(true);
      } else {
        setNewUserGuideVisible(false);
      }
    } catch {
      setNewUserGuideVisible(demoRole === "new_employee" || demoRole === "new_manager");
    }
  }, [demoRole]);

  useEffect(() => {
    setWriteMode("choice");
    setModeChoiceVisible(false);
    setChatInput("");
    setRevisionCount(0);
    setMessages([]);
    setBatchFeedbackPhase(null);
    setBatchFeedbackItems([]);
    setActiveBatchSubId(null);
    setBatchPreviewOpen(false);
    setBatchOptimizationSubId(null);
    setGenerationGuideConfirm(null);
    setMidyearSummarySubId(null);
    setSubGroupFilter("direct");
    setSubStatusFilter("pending_feedback");
    setActiveTargetId("self");
    setDrawerTargetId(null);
    setDrawerExpanded(false);
    onSelectSub(null);
  }, [activeTab, demoRole, roleCanReviewSubs, onSelectSub]);

  const closeNewUserGuide = () => {
    setNewUserGuideVisible(false);
    try {
      window.localStorage.setItem("performance-hub-v4-new-user-guide-seen", "1");
    } catch {
      // Keep the current dismiss state even if persistence is unavailable.
    }
  };

  const selectTarget = (
    targetId: VersionFourTargetId,
    options: { openDetail?: boolean; resetMessages?: boolean } = {},
  ) => {
    const { openDetail = true, resetMessages = true } = options;
    setActiveTargetId(targetId);
    if (openDetail) setDrawerTargetId(targetId);
    setDrawerExpanded(false);
    setWriteMode("choice");
    setModeChoiceVisible(false);
    setChatInput("");
    setFeedbackPickerVisible(false);
    setBatchOptimizationSubId(null);
    setMidyearSummarySubId(null);
    if (targetId === "self") {
      onSelectSub(null);
      if (resetMessages) setMessages([]);
    } else {
      const sub = subs.find((item) => item.id === targetId);
      if (sub) {
        onSelectSub(sub);
        if (resetMessages) setMessages([]);
      }
    }
  };

  const chooseWriteMode = (nextMode: Exclude<VersionFourWriteMode, "choice">) => {
    setWriteMode(nextMode);
    setModeChoiceVisible(false);
    setGenerationGuideConfirm(null);
    setMessages((prev) => [
      ...prev,
      {
        id: `user-mode-${Date.now()}`,
        role: "user",
        text: nextMode === "direct" ? "自主填写" : "智能辅助生成",
      },
      {
        id: `assistant-mode-${Date.now()}`,
        role: "assistant",
        text: nextMode === "direct"
          ? `好的，我已打开直接填写页面。你可以手动填写${cycle.isMidyear ? "核心KPI、关键工作、主要贡献、不足及遗憾、附件建议和自评分" : "综合汇报、KPI、关键工作和评分"}。`
          : activeMode === "report"
            ? (cycle.isMidyear
              ? `好的，我会基于${cycle.sourceText}生成个人年中汇报初稿，你可以继续通过对话调整。`
              : "好的，我会先根据本期绩效目标生成个人月度汇报草稿，你可以继续通过对话调整。")
            : (cycle.isMidyear
              ? `好的，我会基于${activeSub?.name ?? "该成员"}的年中总结、核心KPI、关键工作、历史反馈和附件材料直接生成年中反馈建议。`
              : `好的，我会先根据${activeSub?.name ?? "该成员"}的月报、KPI 和关键工作生成主考反馈草稿，你可以继续通过对话调整。`),
      },
    ]);
  };

  const requestAiGeneration = () => {
    const needsGuideConfirm =
      (activeMode === "report" && (cycle.isMidyear || demoRole === "new_employee")) ||
      (activeMode === "feedback" && !cycle.isMidyear && demoRole === "new_manager");
    if (!needsGuideConfirm) {
      chooseWriteMode("ai");
      return;
    }
    setWriteMode("choice");
    setModeChoiceVisible(false);
    setGenerationGuideConfirm(activeMode === "report" ? "personal" : "feedback");
  };

  const savePersonalDraft = (report: PersonalReport) => {
    setSavedPersonalDraft(report);
    try {
      window.localStorage.setItem(VERSION_FOUR_PERSONAL_DRAFT_KEY, JSON.stringify(report));
    } catch {
      // Ignore storage errors; current session still keeps the draft.
    }
    toast.success("个人汇报草稿已保存");
  };

  const saveFeedbackDraft = (sub: Subordinate, draft: FeedbackDraft, scoreMap: Record<string, number>) => {
    setSavedFeedbackDraftBySubId((prev) => {
      const next = { ...prev, [sub.id]: { draft, scoreMap } };
      try {
        window.localStorage.setItem(VERSION_FOUR_FEEDBACK_DRAFT_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors; current session still keeps the draft.
      }
      return next;
    });
    toast.success(`${sub.name}的反馈草稿已保存`);
  };

  const shouldRecommendPersonalReport = !cycle.isMidyear && personalReportStatus === "pending_submit";
  const openPersonalReportEntry = () => {
    setActiveTargetId("self");
    onSelectSub(null);
    setDrawerTargetId(null);
    setDrawerExpanded(false);
    setWriteMode("choice");
    setModeChoiceVisible(true);
    setFeedbackPickerVisible(false);
    setPendingSubmitListVisible(false);
    setBatchFeedbackPhase(null);
    setBatchPreviewOpen(false);
    setBatchOptimizationSubId(null);
  };
  const openFeedbackEntry = () => {
    setWriteMode("choice");
    setModeChoiceVisible(false);
    setFeedbackPickerVisible(true);
    setPendingSubmitListVisible(false);
    setBatchFeedbackPhase(null);
    setBatchPreviewOpen(false);
    setBatchOptimizationSubId(null);
  };
  const appendPostReportRecommendation = (baseText: string) => {
    if (!roleCanReviewSubs) return baseText;
    if (pendingFeedbackSubs.length > 0) {
      return `${baseText}\n\n下一步建议：您还有 ${pendingFeedbackSubs.length} 位直接下属已提交总结待反馈，已为您打开待反馈列表，可选择单人反馈或批量反馈。`;
    }
    if (pendingSubmitSubs.length > 0) {
      return `${baseText}\n\n下一步建议：仍有 ${pendingSubmitSubs.length} 位下属尚未提交总结，可先一键催办或稍后跟进。`;
    }
    return baseText;
  };
  const appendPostFeedbackRecommendation = (baseText: string, remainingPendingCount: number) => {
    if (shouldRecommendPersonalReport) {
      return `${baseText}\n\n下一步建议：您还未提交个人月度汇报，建议现在继续完成。已为您打开个人月度汇报入口，可选择自主填写或智能辅助生成。`;
    }
    if (remainingPendingCount > 0) {
      return `${baseText}\n\n下一步建议：您还有 ${remainingPendingCount} 位直接下属待反馈，已为您打开待反馈列表，可继续单人反馈或批量处理。`;
    }
    if (pendingSubmitSubs.length > 0) {
      return `${baseText}\n\n下一步建议：仍有 ${pendingSubmitSubs.length} 位下属尚未提交总结，可先一键催办或稍后跟进。`;
    }
    return baseText;
  };

  const submitPersonalReport = (report: PersonalReport, withEmail: boolean) => {
    onPersonalSubmitted(buildSubmittedPersonalMonthlyReport(report, cycle.periodKey));
    setSavedPersonalDraft(null);
    try {
      window.localStorage.removeItem(VERSION_FOUR_PERSONAL_DRAFT_KEY);
    } catch {
      // Ignore storage errors.
    }
    if (roleCanReviewSubs && pendingFeedbackSubs.length > 0) {
      openFeedbackEntry();
    }
    const baseText = withEmail
      ? `已将${cycle.personalReportName}录入系统，并生成发送给主考人的邮件。`
      : `已将${cycle.personalReportName}录入系统，当前状态更新为等待主考反馈。`;
    setMessages((prev) => [
      ...prev,
      {
        id: `assistant-report-${Date.now()}`,
        role: "assistant",
        text: appendPostReportRecommendation(baseText),
      },
    ]);
  };

  const submitFeedback = (draft: FeedbackDraft, withEmail: boolean) => {
    if (!activeSub) return;
    onFeedbackSubmitted(activeSub.id, {
      period: cycle.periodKey,
      submittedAt: new Date().toISOString(),
      score: draft.score,
      highlights: draft.highlights,
      shortcomings: draft.shortcomings,
      nextFocus: draft.nextFocus,
    });
    setSavedFeedbackDraftBySubId((prev) => {
      const next = { ...prev };
      delete next[activeSub.id];
      try {
        window.localStorage.setItem(VERSION_FOUR_FEEDBACK_DRAFT_KEY, JSON.stringify(next));
      } catch {
        // Ignore storage errors.
      }
      return next;
    });
    const remainingPendingSubs = pendingFeedbackSubs.filter((sub) => sub.id !== activeSub.id);
    setWriteMode("choice");
    if (shouldRecommendPersonalReport) {
      openPersonalReportEntry();
    } else {
      setFeedbackPickerVisible(remainingPendingSubs.length > 0);
      setModeChoiceVisible(false);
    }
    setPendingSubmitListVisible(false);
    setBatchFeedbackPhase(null);
    const baseText = remainingPendingSubs.length > 0
      ? `${activeSub.name}的${cycle.feedbackName}已完成，您可以继续完成其他下属反馈。${withEmail ? "\n\n已生成待发送邮件。" : ""}`
      : `${activeSub.name}的${cycle.feedbackName}已完成。${withEmail ? "\n\n已生成待发送邮件。" : ""}\n\n${cycle.isMidyear ? "当前已提交年中总结的下属反馈已全部完成。" : "本月已提交下属的反馈已全部完成。"}`;
    setMessages((prev) => [
      ...prev,
      {
          id: `assistant-feedback-${Date.now()}`,
          role: "assistant",
          text: appendPostFeedbackRecommendation(baseText, remainingPendingSubs.length),
      },
    ]);
  };

  const confirmPreviewToSystem = async (sendEmail: boolean) => {
    if (!previewSubmission) return;
    setSubmittingPreview(true);
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    if (previewSubmission.kind === "personal") {
      submitPersonalReport(previewSubmission.report, sendEmail);
      if (sendEmail) {
        setEmailSubName(CURRENT_USER.name);
        setEmailDraft(buildPersonalReportEmailDraft(previewSubmission.report, getReportGuideCycle(activeTab)));
      }
    } else {
      const { sub, draft, scoreMap } = previewSubmission;
      onFeedbackSubmitted(sub.id, {
        period: cycle.periodKey,
        submittedAt: new Date().toISOString(),
        score: draft.score,
        highlights: draft.highlights,
        shortcomings: draft.shortcomings,
        nextFocus: draft.nextFocus,
      });
      setSavedFeedbackDraftBySubId((prev) => {
        const next = { ...prev };
        delete next[sub.id];
        try {
          window.localStorage.setItem(VERSION_FOUR_FEEDBACK_DRAFT_KEY, JSON.stringify(next));
        } catch {
          // Ignore storage errors.
        }
        return next;
      });
      const remainingPendingSubs = pendingFeedbackSubs.filter((item) => item.id !== sub.id);
      setPendingSubmitListVisible(false);
      setWriteMode("choice");
      if (shouldRecommendPersonalReport) {
        openPersonalReportEntry();
      } else {
        setFeedbackPickerVisible(remainingPendingSubs.length > 0);
        setModeChoiceVisible(false);
      }
      setBatchFeedbackPhase(null);
      const baseText = remainingPendingSubs.length > 0
        ? `${sub.name}的${cycle.feedbackName}已完成，您可以继续完成其他下属反馈。${sendEmail ? "\n\n已生成待发送邮件。" : ""}`
        : `${sub.name}的${cycle.feedbackName}已完成。${sendEmail ? "\n\n已生成待发送邮件。" : ""}\n\n${cycle.isMidyear ? "当前已提交年中总结的下属反馈已全部完成。" : "本月已提交下属的反馈已全部完成。"}`;
      setMessages((prev) => [
        ...prev,
        {
          id: `preview-feedback-${Date.now()}`,
          role: "assistant",
          text: appendPostFeedbackRecommendation(baseText, remainingPendingSubs.length),
        },
      ]);
      if (sendEmail) {
        setEmailSubName(sub.name);
        setEmailDraft(buildFeedbackEmailDraft(sub, draft, scoreMap, getReportGuideCycle(activeTab)));
      }
    }
    setPreviewSubmission(null);
    setSubmittingPreview(false);
  };

  const confirmEmailSend = () => {
    toast.success(emailSubName === CURRENT_USER.name ? "汇报邮件已发送" : `${emailSubName}的反馈邮件已发送`);
    setEmailDraft(null);
    setEmailSubName("");
  };

  const createBatchFeedbackItems = (targetSubs: Subordinate[], status: VersionFourBatchFeedbackItem["status"] = "pending") =>
    targetSubs.map((sub) => {
      const scoreMap = getDefaultFeedbackScores();
      return {
        sub,
        scoreMap,
        draft: cycle.isMidyear
          ? buildMidyearManagerFeedbackDraft(SAMPLE_SUB_DATA_BY_ID[sub.id] ?? null, sub.name, computeDirectFeedbackScore(scoreMap))
          : buildManagerFeedbackDraft(SAMPLE_SUB_DATA_BY_ID[sub.id] ?? null, sub.name, computeDirectFeedbackScore(scoreMap)),
        status,
        emailSent: false,
      };
    });

  const startBatchFeedbackConfirm = (targetSubs: Subordinate[] = pendingFeedbackSubs) => {
    if (targetSubs.length === 0) return;
    setFeedbackPickerVisible(false);
    setPendingSubmitListVisible(false);
    setBatchOptimizationSubId(null);
    setBatchFeedbackItems(createBatchFeedbackItems(targetSubs, "pending"));
    setActiveBatchSubId(targetSubs[0]?.id ?? null);
    setBatchFeedbackPhase("confirm");
    setMessages((prev) => [
      ...prev,
      { id: `batch-user-${Date.now()}`, role: "user", text: "批量反馈" },
      {
        id: `batch-confirm-${Date.now()}`,
        role: "assistant",
        text: `将为当前 ${targetSubs.length} 位已提交${cycle.submittedSummaryName}的下属批量生成${cycle.feedbackName}初稿。\n\n为避免反馈内容混淆，系统会为每位下属分别生成独立反馈。生成后您可以逐个预览、逐个修订和确认。\n\n是否开始批量生成？`,
      },
    ]);
  };

  const cancelBatchFeedback = () => {
    setBatchFeedbackPhase(null);
    setBatchFeedbackItems([]);
    setActiveBatchSubId(null);
    setBatchOptimizationSubId(null);
    setFeedbackPickerVisible(true);
  };

  const startBatchFeedbackGeneration = async () => {
    if (batchFeedbackItems.length === 0) return;
    setBatchFeedbackPhase("generating");
    setBatchFeedbackItems((items) => items.map((item) => ({ ...item, status: "generating" })));
    await new Promise((resolve) => window.setTimeout(resolve, 650));
    setBatchFeedbackItems((items) => items.map((item) => ({ ...item, status: "pending" })));
    setBatchFeedbackPhase("ready");
    setMessages((prev) => [
      ...prev,
      {
        id: `batch-ready-${Date.now()}`,
        role: "assistant",
        text: `已为 ${batchFeedbackItems.length} 位下属生成${cycle.feedbackName}初稿，请逐个查看并确认。`,
      },
    ]);
  };

  const showBatchFeedbackDetail = (subId: string) => {
    const item = batchFeedbackItems.find((entry) => entry.sub.id === subId);
    if (!item) return;
    setActiveBatchSubId(subId);
    setBatchFeedbackPhase("detail");
    setBatchOptimizationSubId(null);
    setActiveTargetId(subId);
    onSelectSub(item.sub);
    setWriteMode("choice");
    setModeChoiceVisible(false);
  };

  const updateBatchFeedbackDraft = (subId: string, patch: Partial<FeedbackDraft>) => {
    setBatchFeedbackItems((items) =>
      items.map((item) => {
        if (item.sub.id !== subId) return item;
        const nextDraft = { ...item.draft, ...patch };
        return {
          ...item,
          draft: {
            ...nextDraft,
            feedbackText: getFeedbackText(nextDraft),
          },
        };
      }),
    );
  };

  const updateBatchFeedbackScore = (subId: string, scoreId: string, value: string) => {
    const nextScore = normalizeScore(value);
    if (nextScore == null) return;
    setBatchFeedbackItems((items) =>
      items.map((item) => {
        if (item.sub.id !== subId) return item;
        const nextScoreMap = { ...item.scoreMap, [scoreId]: nextScore };
        const nextDraft = { ...item.draft, score: computeDirectFeedbackScore(nextScoreMap) };
        return {
          ...item,
          scoreMap: nextScoreMap,
          draft: {
            ...nextDraft,
            feedbackText: getFeedbackText(nextDraft),
          },
        };
      }),
    );
  };

  const optimizeBatchFeedback = (subId: string) => {
    const item = batchFeedbackItems.find((entry) => entry.sub.id === subId);
    if (!item) return;
    const revised = buildFeedbackRevisionContent(item.draft, "语气更委婉，补充项目结果，不足写得更具体", ["p3", "p6"]);
    updateBatchFeedbackDraft(subId, {
      highlights: revised.highlights,
      shortcomings: revised.shortcomings,
      nextFocus: revised.nextFocus,
      optimized: { highlights: true, shortcomings: true, nextFocus: true },
      optimizedItemIds: ["p3", "p6"],
      scoreNotes: {
        ...(item.draft.scoreNotes ?? {}),
        p3: "已补充风险识别、过程沟通和改进动作依据。",
        p6: "已补充协同记录和下月里程碑跟进要求。",
      },
    });
    setBatchOptimizationSubId(subId);
    setMessages((prev) => [
      ...prev,
      {
        id: `batch-optimize-${Date.now()}`,
        role: "assistant",
        text: `已优化${item.sub.name}的反馈内容，仅更新当前人员反馈。`,
      },
    ]);
  };

  const showBatchFeedbackEvidence = (subId: string) => {
    const item = batchFeedbackItems.find((entry) => entry.sub.id === subId);
    if (!item) return;
    setMessages((prev) => [
      ...prev,
      {
        id: `batch-evidence-${Date.now()}`,
        role: "assistant",
        text: `${item.sub.name}的评分依据：结合${cycle.isMidyear ? "上半年核心KPI完成度、关键工作推进质量、1-6月月度汇报、历史反馈关键词和附件材料" : "本月 KPI 完成度、关键工作推进质量、历史反馈关键词和当前月度总结"}，建议综合评分 ${item.draft.score} 分。重点关注结果质量、风险识别、协同表现和${cycle.isMidyear ? "下阶段改进抓手" : "下月改进抓手"}。`,
      },
    ]);
  };

  const switchToNextBatchFeedback = () => {
    const pendingItems = batchFeedbackItems.filter((item) => item.status !== "confirmed");
    if (pendingItems.length === 0) {
      setBatchFeedbackPhase("complete");
      setActiveBatchSubId(null);
      return;
    }
    const currentIndex = pendingItems.findIndex((item) => item.sub.id === activeBatchSubId);
    const nextItem = pendingItems[(currentIndex + 1 + pendingItems.length) % pendingItems.length];
    showBatchFeedbackDetail(nextItem.sub.id);
  };

  const confirmBatchFeedbackItem = (subId: string, sendEmail: boolean) => {
    const item = batchFeedbackItems.find((entry) => entry.sub.id === subId);
    if (!item) return;
    onFeedbackSubmitted(item.sub.id, {
      period: cycle.periodKey,
      submittedAt: new Date().toISOString(),
      score: item.draft.score,
      highlights: item.draft.highlights,
      shortcomings: item.draft.shortcomings,
      nextFocus: item.draft.nextFocus,
    });
    const nextItems = batchFeedbackItems.map((entry) =>
      entry.sub.id === subId ? { ...entry, status: "confirmed" as const, emailSent: entry.emailSent || sendEmail } : entry,
    );
    setBatchFeedbackItems(nextItems);
    const currentItemIndex = nextItems.findIndex((entry) => entry.sub.id === subId);
    const nextPending =
      nextItems.slice(currentItemIndex + 1).find((entry) => entry.status !== "confirmed") ??
      nextItems.slice(0, Math.max(currentItemIndex, 0)).find((entry) => entry.status !== "confirmed");
    if (nextPending) {
      setActiveBatchSubId(batchPreviewOpen ? nextPending.sub.id : null);
      setBatchFeedbackPhase(batchPreviewOpen ? "ready" : null);
      setBatchPreviewOpen(batchPreviewOpen);
      setBatchOptimizationSubId(null);
      setWriteMode("choice");
      setModeChoiceVisible(false);
      setPendingSubmitListVisible(false);
      setFeedbackPickerVisible(!batchPreviewOpen);
      if (batchPreviewOpen) {
        setActiveTargetId(nextPending.sub.id);
        onSelectSub(nextPending.sub);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `batch-confirmed-${Date.now()}`,
            role: "assistant",
            text: `${item.sub.name}的${cycle.feedbackName}已完成，您可以继续完成其他下属反馈。${sendEmail ? "\n\n已发送邮件。" : ""}`,
          },
        ]);
      }
    } else {
      setActiveBatchSubId(null);
      if (shouldRecommendPersonalReport) {
        openPersonalReportEntry();
      } else {
        setBatchFeedbackPhase("complete");
        setBatchPreviewOpen(false);
        setWriteMode("choice");
        setModeChoiceVisible(false);
        setFeedbackPickerVisible(false);
      }
      const baseText = `本次批量反馈已处理完成。\n\n共生成 ${nextItems.length} 位下属反馈，已录入系统 ${nextItems.filter((entry) => entry.status === "confirmed").length} 人，已发送邮件 ${nextItems.filter((entry) => entry.emailSent).length} 人。`;
      setMessages((prev) => [
        ...prev,
        {
          id: `batch-complete-${Date.now()}`,
          role: "assistant",
          text: appendPostFeedbackRecommendation(baseText, 0),
        },
      ]);
    }
  };

  const sendMessage = () => {
    const text = chatInput.trim();
    if (!text) return;
    setChatInput("");
    if (batchFeedbackPhase === "detail" && activeBatchItem) {
      const otherMentioned = batchFeedbackItems.find((item) => item.sub.id !== activeBatchItem.sub.id && text.includes(item.sub.name));
      if (otherMentioned) {
        setMessages((prev) => [
          ...prev,
          { id: `user-${Date.now()}`, role: "user", text },
          {
            id: `batch-context-guard-${Date.now()}`,
            role: "assistant",
            text: `您当前正在处理${activeBatchItem.sub.name}的反馈。\n如需修改${otherMentioned.sub.name}的反馈，请先切换至${otherMentioned.sub.name}。`,
          },
        ]);
        return;
      }
      if (/优化|修改|补充|调整|改写|更委婉|更具体|强化/.test(text)) {
        const revised = buildFeedbackRevisionContent(activeBatchItem.draft, text, getFeedbackOptimizationTargets(text));
        updateBatchFeedbackDraft(activeBatchItem.sub.id, {
          highlights: revised.highlights,
          shortcomings: revised.shortcomings,
          nextFocus: revised.nextFocus,
          optimized: { highlights: true, shortcomings: true, nextFocus: true },
          optimizedItemIds: getFeedbackOptimizationTargets(text),
        });
        setBatchOptimizationSubId(activeBatchItem.sub.id);
        setMessages((prev) => [
          ...prev,
          { id: `user-${Date.now()}`, role: "user", text },
          {
            id: `batch-context-update-${Date.now()}`,
            role: "assistant",
            text: `已根据你的要求优化${activeBatchItem.sub.name}的反馈内容，仅更新当前人员反馈。`,
          },
        ]);
        return;
      }
    }
    if (/生成|初稿|草稿|参考/.test(text)) {
      const wantsSubFeedback = /下属|员工|反馈/.test(text) && /反馈/.test(text);
      const needsPersonalGuideConfirm = activeMode === "report" && (cycle.isMidyear || demoRole === "new_employee") && !wantsSubFeedback;
      const needsFeedbackGuideConfirm = !cycle.isMidyear && demoRole === "new_manager" && (activeMode === "feedback" || wantsSubFeedback);
      if (needsPersonalGuideConfirm || needsFeedbackGuideConfirm) {
        setWriteMode("choice");
        setModeChoiceVisible(false);
        setGenerationGuideConfirm(needsFeedbackGuideConfirm ? "feedback" : "personal");
        setMessages((prev) => [
          ...prev,
          { id: `user-${Date.now()}`, role: "user", text },
          {
            id: `assistant-${Date.now()}-guide-confirm`,
            role: "assistant",
            text: needsFeedbackGuideConfirm
              ? "我将基于下属月度汇报、核心KPI、关键工作和历史反馈生成反馈初稿。生成前建议先确认月度绩效反馈指南，也可以直接生成反馈。"
              : cycle.isMidyear
                ? "我将基于您的核心KPI、关键工作、1-6月月度汇报、历史主管反馈和附件材料生成个人年中汇报初稿。生成前建议先确认填写指南，也可以直接生成初稿。"
                : "我将基于您的本期绩效目标、年度计划、上月汇报和历史上级反馈生成个人月度汇报初稿。生成前建议先确认填写指南，也可以直接生成初稿。",
          },
        ]);
        return;
      }
      setWriteMode("ai");
      setModeChoiceVisible(false);
      setRevisionCount((count) => count + 1);
    } else if (/自主|手动|自己填|直接填写/.test(text)) {
      setWriteMode("direct");
      setModeChoiceVisible(false);
    } else if (/优化|修改|补充|调整|改写|更严格|强化/.test(text)) {
      setRevisionCount((count) => count + 1);
    }
    if (isMonthlyReportGuideRequest(text)) {
      onOpenMonthlyGuide(activeMode === "report" ? "summary" : "feedback");
    }
    setMessages((prev) => [
      ...prev,
      { id: `user-${Date.now()}`, role: "user", text },
      {
        id: `assistant-${Date.now()}-reply`,
        role: "assistant",
        text: buildVersionFourAssistantAnswer(text, {
          activeTab,
          activeMode,
          activeSub,
          pendingFeedbackSubs,
          pendingSubmitSubs,
        }),
      },
    ]);
  };

  const askFeedbackHistorySummary = () => {
    const text = "查看 1-4 月反馈总结";
    setMessages((prev) => [
      ...prev,
      { id: `quick-user-${Date.now()}`, role: "user", text },
      {
        id: `quick-assistant-${Date.now()}`,
        role: "assistant",
        text: buildVersionFourAssistantAnswer(text, {
          activeTab,
          activeMode,
          activeSub,
          pendingFeedbackSubs,
          pendingSubmitSubs,
        }),
      },
    ]);
  };

  const startPersonalDraftFromAssistant = (text: string) => {
    selectTarget("self", { openDetail: false, resetMessages: false });
    setPendingSubmitListVisible(false);
    setFeedbackPickerVisible(false);
    setBatchOptimizationSubId(null);
    if (cycle.isMidyear || demoRole === "new_employee") {
      setWriteMode("choice");
      setModeChoiceVisible(false);
      setGenerationGuideConfirm("personal");
      setMessages((prev) => [
        ...prev,
        { id: `prompt-user-${Date.now()}`, role: "user", text },
        {
          id: `prompt-assistant-${Date.now()}`,
          role: "assistant",
          text: cycle.isMidyear
            ? "我将基于您的核心KPI、关键工作、1-6月月度汇报、历史主管反馈和附件材料生成个人年中汇报初稿。生成前建议先确认填写指南，也可以直接生成初稿。"
            : "我将基于您的本期绩效目标、年度计划、上月汇报和历史上级反馈生成个人月度汇报初稿。生成前建议先确认填写指南，也可以直接生成初稿。",
        },
      ]);
      return;
    }
    setWriteMode("ai");
    setModeChoiceVisible(false);
    setRevisionCount((count) => count + 1);
    setMessages((prev) => [
      ...prev,
      { id: `prompt-user-${Date.now()}`, role: "user", text },
      {
        id: `prompt-assistant-${Date.now()}`,
        role: "assistant",
        text: buildVersionFourAssistantAnswer(text, {
          activeTab,
          activeMode: "report",
          activeSub: null,
          pendingFeedbackSubs,
          pendingSubmitSubs,
        }),
      },
    ]);
  };

  const startFeedbackPickerFromAssistant = (text: string) => {
    setWriteMode("choice");
    setModeChoiceVisible(false);
    setPendingSubmitListVisible(false);
    setFeedbackPickerVisible(true);
    setBatchFeedbackPhase(null);
    setBatchFeedbackItems([]);
    setActiveBatchSubId(null);
    setBatchOptimizationSubId(null);
    setMessages((prev) => [
      ...prev,
      { id: `prompt-user-${Date.now()}`, role: "user", text },
      {
        id: `prompt-assistant-${Date.now()}`,
        role: "assistant",
        text: cycle.isMidyear
          ? "您需要生成哪位下属的年中反馈？以下是已提交年中总结、等待反馈的下属名单。可以选择单人反馈，也可以发起批量反馈。"
          : "您需要生成哪位下属的月度反馈？以下是已提交汇报、等待反馈的下属名单。",
      },
    ]);
  };

  const generateFeedbackForSub = (sub: Subordinate) => {
    selectTarget(sub.id, { openDetail: false, resetMessages: false });
    setPendingSubmitListVisible(false);
    setFeedbackPickerVisible(false);
    setModeChoiceVisible(false);
    if (cycle.isMidyear) {
      setWriteMode("ai");
      setMidyearSummarySubId(null);
      setRevisionCount((count) => count + 1);
      setMessages((prev) => [
        ...prev,
        { id: `feedback-target-user-${Date.now()}`, role: "user", text: sub.name },
        {
          id: `feedback-target-assistant-${Date.now()}`,
          role: "assistant",
          text: `已生成${sub.name}年中反馈建议，包含评分建议、综合评价、主要贡献评价、不足评价、评估模型建议、综合能力和发展趋势。`,
        },
      ]);
      return;
    }
    setWriteMode("ai");
    setRevisionCount((count) => count + 1);
    setMessages((prev) => [
      ...prev,
      { id: `feedback-target-user-${Date.now()}`, role: "user", text: sub.name },
      {
        id: `feedback-target-assistant-${Date.now()}`,
        role: "assistant",
        text: buildVersionFourAssistantAnswer(`生成${sub.name}${cycle.feedbackName}初稿`, {
          activeTab,
          activeMode: "feedback",
          activeSub: sub,
          pendingFeedbackSubs,
          pendingSubmitSubs,
        }),
      },
    ]);
  };

  const generateMidyearSupervisorFeedback = (sub: Subordinate) => {
    setActiveTargetId(sub.id);
    onSelectSub(sub);
    setWriteMode("ai");
    setModeChoiceVisible(false);
    setMidyearSummarySubId(null);
    setRevisionCount((count) => count + 1);
    setMessages((prev) => [
      ...prev,
      { id: `midyear-generate-user-${Date.now()}`, role: "user", text: "生成主管反馈" },
      {
        id: `midyear-generate-assistant-${Date.now()}`,
        role: "assistant",
        text: `已生成${sub.name}年中反馈建议，包含评分建议、综合评价、主要贡献评价、不足评价、评估模型建议、综合能力和发展趋势。`,
      },
    ]);
  };

  const runAssistantPrompt = (prompt: VersionFourAssistantPrompt) => {
    if (prompt.kind === "feedback_guide_open") {
      onOpenMonthlyGuide("feedback");
      return;
    }
    if (prompt.kind === "feedback_structure") {
      setPendingSubmitListVisible(false);
      setFeedbackPickerVisible(false);
      setMessages((prev) => [
        ...prev,
        { id: `prompt-user-${Date.now()}`, role: "user", text: prompt.text },
        {
          id: `prompt-assistant-${Date.now()}`,
          role: "assistant",
          text: cycle.isMidyear
            ? "年中绩效反馈建议包含五部分：\n1. 整体评价：说明上半年阶段表现、目标达成和综合判断。\n2. 亮点肯定：结合核心KPI、关键工作和贡献亮点，肯定可验证成果。\n3. 不足提醒：指出目标差距、过程风险或协同问题。\n4. 下阶段建议：明确下半年优先级、里程碑和检查点。\n5. 审批意见：说明同意提交、退回修改或需补充材料。"
            :
            "绩效反馈建议包含四部分：\n" +
            "1. 亮点：说明下属本月完成了哪些关键结果，最好对应 KPI、重点项目或具体数据。\n" +
            "2. 不足：指出目标差距、过程风险或协同问题，避免只写笼统评价。\n" +
            "3. 建议：给出下月可执行的改进方向、检查点和资源支持。\n" +
            "4. 评分依据：说明主考评分如何对应完成质量、目标达成度、关键行为和历史表现。",
        },
      ]);
      return;
    }
    if (prompt.kind === "guide" || prompt.kind === "feedback_guide") {
      onOpenMonthlyGuide(prompt.kind === "guide" ? "summary" : "feedback");
    }
    if (prompt.kind === "personal_draft") {
      startPersonalDraftFromAssistant(prompt.text);
      return;
    }
    if (prompt.kind === "feedback_draft") {
      if (!cycle.isMidyear && demoRole === "new_manager") {
        setWriteMode("choice");
        setModeChoiceVisible(false);
        setPendingSubmitListVisible(false);
        setFeedbackPickerVisible(false);
        setGenerationGuideConfirm("feedback");
        setMessages((prev) => [
          ...prev,
          { id: `prompt-user-${Date.now()}`, role: "user", text: prompt.text },
          {
            id: `prompt-assistant-${Date.now()}`,
            role: "assistant",
            text: "我将基于下属月度汇报、核心KPI、关键工作和历史反馈生成反馈初稿。生成前建议先确认月度绩效反馈指南，也可以直接生成反馈。",
          },
        ]);
        return;
      }
      if (activeMode === "feedback" && activeSub) {
        generateFeedbackForSub(activeSub);
      } else {
        startFeedbackPickerFromAssistant(prompt.text);
      }
      return;
    }
    if (prompt.kind === "missing_reports" && /催办/.test(prompt.text)) {
      pendingSubmitSubs.forEach((sub) => onRemindSub(sub));
      setPendingSubmitListVisible(false);
      setFeedbackPickerVisible(false);
      setMessages((prev) => [
        ...prev,
        { id: `prompt-user-${Date.now()}`, role: "user", text: prompt.text },
        {
          id: `prompt-assistant-${Date.now()}`,
          role: "assistant",
          text: appendVersionFourDetailHint(`已向 ${pendingSubmitSubs.length} 名未提交下属发送催办提醒。系统会保留冷却时间，避免重复频繁催办。`),
        },
      ]);
      return;
    }
    setMessages((prev) => [
      ...prev,
      { id: `prompt-user-${Date.now()}`, role: "user", text: prompt.text },
      {
        id: `prompt-assistant-${Date.now()}`,
        role: "assistant",
        text: buildVersionFourAssistantAnswer(prompt.text, {
          activeTab,
          activeMode,
          activeSub,
          pendingFeedbackSubs,
          pendingSubmitSubs,
        }),
      },
    ]);
  };

  const startPersonalTodo = () => {
    const text = cycle.isMidyear ? "去填写个人年中汇报" : "去填写个人月度汇报";
    selectTarget("self", { openDetail: false, resetMessages: false });
    setPendingSubmitListVisible(false);
    setFeedbackPickerVisible(false);
    setBatchFeedbackPhase(null);
    setBatchFeedbackItems([]);
    setActiveBatchSubId(null);
    setBatchPreviewOpen(false);
    setBatchOptimizationSubId(null);
    setGenerationGuideConfirm(null);
    setWriteMode("ai");
    setModeChoiceVisible(false);
    setRevisionCount((count) => count + 1);
    setMessages((prev) => [
      ...prev,
      { id: `todo-personal-user-${Date.now()}`, role: "user", text },
      {
        id: `todo-personal-${Date.now()}`,
        role: "assistant",
        text: cycle.isMidyear
          ? "已进入个人年中汇报 AI 生成流程，我会基于核心KPI、关键工作、1-6月月度汇报、历史主管反馈和附件材料生成初稿。"
          : "已进入个人月度汇报 AI 生成流程，我会基于本期绩效目标、月报、KPI 和历史反馈生成初稿。",
      },
    ]);
  };

  const startFeedbackTodo = () => {
    const target = pendingFeedbackSubs[0] ?? subs.find((sub) => sub.status === "pending_feedback");
    if (!target) return;
    setSidebarCollapsed(true);
    selectTarget(target.id, { openDetail: false });
    setModeChoiceVisible(true);
    setMessages([
      {
        id: `todo-feedback-${Date.now()}`,
        role: "assistant",
        text: `先从${target.name}开始处理待反馈事项。请选择自主填写，或让我基于其月度汇报和 KPI 生成反馈草稿。`,
      },
    ]);
  };

  const startPendingSubmitTodo = () => {
    setSubStatusFilter("pending_submit");
    setPendingSubmitListVisible(true);
    setFeedbackPickerVisible(false);
    setMessages((prev) => [
      ...prev,
      {
        id: `todo-submit-user-${Date.now()}`,
        role: "user",
        text: "查看待提交下属名单",
      },
      {
        id: `todo-submit-${Date.now()}`,
        role: "assistant",
        text: "本月待提交人员如下：",
      },
    ]);
  };

  const remindPendingSubmitSubs = () => {
    pendingSubmitSubs.forEach((sub) => onRemindSub(sub));
    setFeedbackPickerVisible(false);
    setMessages((prev) => [
      ...prev,
      {
        id: `todo-remind-user-${Date.now()}`,
        role: "user",
        text: "一键催办待提交下属",
      },
      {
        id: `todo-remind-${Date.now()}`,
        role: "assistant",
        text: `已向 ${pendingSubmitSubs.length} 名待提交人员发送催办提醒。系统会保留冷却时间，避免重复频繁催办。`,
      },
    ]);
  };

  const drawerSub = drawerTargetId && drawerTargetId !== "self"
    ? subs.find((sub) => sub.id === drawerTargetId) ?? null
    : null;
  const detailPanelVisible = Boolean(drawerTargetId);
  const directPersonalDraft: PersonalReport = {
    ...personalDraft,
    summary: "",
    items: personalDraft.items.map((item) => ({ ...item, note: "" })),
  };
  const directFeedbackDraft = feedbackDraft
    ? {
      ...feedbackDraft,
      feedbackText: "",
      highlights: "",
      shortcomings: "",
      nextFocus: "",
    }
    : null;
  const activeBatchItem = activeBatchSubId
    ? batchFeedbackItems.find((item) => item.sub.id === activeBatchSubId) ?? null
    : null;
  const midyearSummarySub = midyearSummarySubId
    ? subs.find((sub) => sub.id === midyearSummarySubId) ?? null
    : null;
  const personalTargetMeta =
    personalReportStatus === "pending_submit"
      ? "写汇报"
      : submittedPersonalReport
        ? `${submittedPersonalReport.report.submittedAt} · ${submittedPersonalReport.metrics.length}项`
        : "已提交";

  if (activeTab !== "monthly" && activeTab !== "midyear") {
    return <ReportCyclePlaceholder activeTab={activeTab} />;
  }

  return (
    <section className="relative h-[calc(100vh-3.5rem)] min-h-0 overflow-hidden bg-[#f4f7fb] p-4">
      <div className={`grid h-full min-h-0 gap-4 transition-[grid-template-columns] duration-200 ${
        sidebarCollapsed
          ? "xl:grid-cols-[72px_minmax(0,1fr)]"
          : "xl:grid-cols-[280px_minmax(0,1fr)] 2xl:grid-cols-[300px_minmax(0,1fr)]"
      }`}>
        <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_44px_rgba(31,47,71,0.06)]">
          <div className={`border-b border-slate-100 ${sidebarCollapsed ? "px-2 py-3" : "px-4 py-4"}`}>
            <div className={`flex items-center ${sidebarCollapsed ? "justify-center" : "gap-2"}`}>
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-white">
                <Sparkles className="h-4 w-4" />
              </span>
              {!sidebarCollapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-semibold text-slate-500">{cycle.periodLabel}</p>
                </div>
              )}
              <button
                type="button"
                onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
                className="grid h-8 w-8 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-primary/30 hover:bg-primary-soft hover:text-primary"
                aria-label={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
                title={sidebarCollapsed ? "展开侧边栏" : "收起侧边栏"}
              >
                {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className={`min-h-0 flex-1 space-y-2 overflow-y-auto ${sidebarCollapsed ? "p-2" : "p-3"}`}>
            {!sidebarCollapsed && (
              <p className="px-1 pb-1 text-[11px] font-black text-slate-400">个人汇报</p>
            )}
            <VersionFourTargetButton
              selected={activeTargetId === "self"}
              name={CURRENT_USER.name}
              title={CURRENT_USER.title}
              avatar={MANAGER_AVATAR_URL}
              badge={personalReportStatus === "pending_submit" ? "待提交" : personalReportStatus === "waiting_feedback" ? "待反馈" : "已反馈"}
              meta={personalTargetMeta}
              collapsed={sidebarCollapsed}
              onClick={() => selectTarget("self")}
            />
            {roleCanReviewSubs && (
            <div className="pt-2">
              <div className="px-1 pb-2">
                {!sidebarCollapsed && (
                  <>
                    <p className="text-[11px] font-black text-slate-400">下属反馈</p>
                    <div className="mt-2 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                      {groupOptions.map((option) => {
                        const active = subGroupFilter === option.key;
                        return (
                          <button
                            key={option.key}
                            type="button"
                            onClick={() => setSubGroupFilter(option.key)}
                            className={`h-8 rounded-lg text-[11px] font-black transition ${
                              active
                                ? "bg-white text-primary shadow-sm"
                                : "text-slate-500 hover:bg-white/70 hover:text-slate-800"
                            }`}
                            aria-pressed={active}
                          >
                            {option.label} {option.count}
                          </button>
                        );
                      })}
                    </div>
                    <div className="mt-2 grid grid-cols-4 gap-1">
                      {ORG_STATUS_FILTERS.map((filter) => {
                        const active = subStatusFilter === filter.key;
                        return (
                          <button
                            key={filter.key}
                            type="button"
                            onClick={() => setSubStatusFilter(filter.key)}
                            className={`min-w-0 rounded-lg border px-1.5 py-1.5 text-[10px] font-black transition ${
                              active
                                ? "border-primary bg-primary text-white shadow-sm"
                                : "border-slate-200 bg-white text-slate-500 hover:border-primary/25 hover:bg-primary-soft hover:text-primary"
                            }`}
                            aria-pressed={active}
                          >
                            <span className="block truncate">{filter.label}</span>
                            <span className={`mt-0.5 block text-[10px] ${active ? "text-white/90" : "text-slate-400"}`}>
                              {statusCountByFilter(filter.key)}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
              <div className="space-y-2">
                {visibleSubs.length > 0 ? visibleSubs.map((sub) => (
                  <VersionFourTargetButton
                    key={sub.id}
                    selected={activeTargetId === sub.id}
                    name={sub.name}
                    title={sub.title}
                    avatar={getPersonAvatarUrl(sub.id, sub.name)}
                    badge={sub.status === "pending_feedback" ? "待反馈" : sub.status === "confirmed" ? "已确认" : sub.status === "reminded" ? "已催办" : "待提交"}
                    meta={sub.status === "pending_feedback" ? "写反馈" : sub.status === "confirmed" ? `${sub.score ?? submittedFeedbackBySubId[sub.id]?.score ?? "--"}分` : "待提交"}
                    showMeta={false}
                    collapsed={sidebarCollapsed}
                    onClick={() => selectTarget(sub.id)}
                  />
                )) : !sidebarCollapsed ? (
                  <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs font-bold text-slate-400">
                    当前筛选下暂无下属
                  </div>
                ) : null}
              </div>
            </div>
            )}
          </div>
        </aside>

        <div className={`grid min-h-0 gap-4 transition-[grid-template-columns] duration-200 ${
          detailPanelVisible
            ? drawerExpanded
              ? "xl:grid-cols-[minmax(640px,0.9fr)_minmax(0,1fr)]"
              : "xl:grid-cols-[minmax(500px,0.58fr)_minmax(0,1fr)]"
            : "xl:grid-cols-[minmax(0,1fr)]"
        }`}>
          {detailPanelVisible && (
            <section className="min-h-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_44px_rgba(31,47,71,0.06)]">
              {drawerTargetId === "self" ? (
                <SubordinatePerformancePanel
                  sub={MANAGER_DETAIL_SUB}
                  onWriteFeedback={() => {}}
                  onRemind={() => {}}
                  remindCooldownMs={0}
                  isManager
                  expanded={drawerExpanded}
                  versionThreeLayout
                  submittedPersonalReports={submittedPersonalReports}
                  headerActions={
                    <VersionFourDrawerActions
                      expanded={drawerExpanded}
                      onToggleExpanded={() => setDrawerExpanded((value) => !value)}
                      onClose={() => setDrawerTargetId(null)}
                    />
                  }
                />
              ) : drawerSub ? (
                <SubordinatePerformancePanel
                  sub={drawerSub}
                  submittedFeedback={submittedFeedbackBySubId[drawerSub.id]}
                  onWriteFeedback={() => {
                    setActiveTargetId(drawerSub.id);
                    onSelectSub(drawerSub);
                    setModeChoiceVisible(true);
                    setWriteMode("choice");
                  }}
                  onRemind={() => onRemindSub(drawerSub)}
                  remindCooldownMs={getRemindCooldownMs(drawerSub.id)}
                  expanded={drawerExpanded}
                  hidePrimaryAction
                  versionThreeLayout
                  headerActions={
                    <VersionFourDrawerActions
                      expanded={drawerExpanded}
                      onToggleExpanded={() => setDrawerExpanded((value) => !value)}
                      onClose={() => setDrawerTargetId(null)}
                    />
                  }
                />
              ) : null}
            </section>
          )}

        <main className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_22px_58px_rgba(31,47,71,0.08)]">
          <div className="relative overflow-hidden border-b border-slate-100 bg-white px-5 py-4">
            <div className="absolute inset-x-0 bottom-0 h-24 bg-[radial-gradient(circle_at_50%_100%,rgba(134,144,156,0.13),transparent_68%)]" />
            <div className="relative flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-base font-black tracking-tight text-slate-950">绩效 AI 助理</p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5 text-slate-500">
                <button
                  type="button"
                  onClick={() => {
                    setMessages([]);
                    setWriteMode("choice");
                    setChatInput("");
                    setBatchFeedbackPhase(null);
                    setBatchFeedbackItems([]);
                    setActiveBatchSubId(null);
                    setBatchPreviewOpen(false);
                    setBatchOptimizationSubId(null);
                    toast.success("已新建对话");
                  }}
                  className="grid h-8 w-8 place-items-center rounded-lg transition hover:bg-primary-soft hover:text-primary"
                  title="新建对话"
                  aria-label="新建对话"
                >
                  <Plus className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setAssistantHistoryOpen((open) => !open)}
                  className={`grid h-8 w-8 place-items-center rounded-lg transition hover:bg-primary-soft hover:text-primary ${
                    assistantHistoryOpen ? "bg-primary-soft text-primary" : ""
                  }`}
                  title="历史对话"
                  aria-label="历史对话"
                >
                  <Clock3 className="h-4 w-4" />
                </button>
                <VersionFourGuideMenu cycle={getReportGuideCycle(activeTab)} onOpenGuide={onOpenMonthlyGuide} />
              </div>
            </div>
          </div>

          {writeMode === "direct" && (
            <div className="min-h-0 flex-1 overflow-y-auto bg-white p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-black text-slate-950">{activeMode === "report" ? `直接填写${cycle.personalReportName}` : `直接填写${activeSub?.name ?? "下属"}${cycle.feedbackName}`}</p>
                  <p className="mt-0.5 text-xs font-semibold text-slate-500">已切换为直接填写页面，草稿会保存在当前浏览器。</p>
                </div>
                <button
                  type="button"
                  onClick={() => chooseWriteMode("ai")}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-primary/25 bg-white px-3 text-xs font-black text-primary shadow-sm transition hover:bg-primary-soft"
                >
                  <Sparkles className="h-4 w-4" />
                  切换智能辅助生成
                </button>
              </div>
              {activeMode === "report" ? (
                <VersionFourPersonalDraftCard
                  key={`direct-report-${savedPersonalDraft ? "saved" : "blank"}`}
                  draft={savedPersonalDraft ?? directPersonalDraft}
                  submittedReport={submittedPersonalReport}
                  status={personalReportStatus}
                  sourceMode="direct"
                  cycle={getReportGuideCycle(activeTab)}
                  onSwitchMode={(nextMode) => chooseWriteMode(nextMode)}
                  onRegenerate={() => setRevisionCount((count) => count + 1)}
                  onSaveDraft={savePersonalDraft}
                  onSubmit={(report) => setPreviewSubmission({ kind: "personal", report })}
                  onSubmitEmail={(report) => setPreviewSubmission({ kind: "personal", report })}
                />
              ) : activeSub && feedbackDraft ? (
                <VersionFourFeedbackDraftCard
                  key={`direct-feedback-${activeSub.id}-${savedFeedbackDraftBySubId[activeSub.id] ? "saved" : "blank"}`}
                  sub={activeSub}
                  draft={savedFeedbackDraftBySubId[activeSub.id]?.draft ?? directFeedbackDraft ?? feedbackDraft}
                  scoreMap={savedFeedbackDraftBySubId[activeSub.id]?.scoreMap ?? feedbackScoreMap}
                  sourceMode="direct"
                  cycle={getReportGuideCycle(activeTab)}
                  onSwitchMode={(nextMode) => chooseWriteMode(nextMode)}
                  onRegenerate={() => setRevisionCount((count) => count + 1)}
                  onSaveDraft={(draft, scoreMap) => saveFeedbackDraft(activeSub, draft, scoreMap)}
                  onSubmit={(draft, scoreMap) => setPreviewSubmission({ kind: "feedback", sub: activeSub, draft, scoreMap })}
                  onSubmitEmail={(draft, scoreMap) => setPreviewSubmission({ kind: "feedback", sub: activeSub, draft, scoreMap })}
                />
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm font-semibold text-slate-500">
                  请先在左侧选择一个下属后填写反馈。
                </div>
              )}
            </div>
          )}

          {writeMode !== "direct" && (
          <>
          <div className="min-h-0 flex-1 overflow-y-auto bg-white px-4 py-3">
            <div className="w-full space-y-3 pb-4">
              {assistantHistoryOpen && (
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                  <p className="text-xs font-black text-slate-500">历史记录</p>
                  <div className="mt-2 space-y-2">
                    <button
                      type="button"
                      className="flex w-full items-center justify-between rounded-xl bg-white px-3 py-2 text-left text-xs font-bold text-slate-700 ring-1 ring-slate-100 transition hover:text-primary"
                    >
                      {activeMode === "report" ? "个人月度汇报检查" : `${activeSub?.name ?? "下属"}绩效反馈分析`}
                      <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
                    </button>
                  </div>
                </div>
              )}

              <p className="pt-0.5 text-left text-[11px] font-bold text-slate-400">已加载全部历史记录</p>

              {messages.length === 0 && (
              <section className="relative overflow-hidden rounded-[28px] border border-blue-100 bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_46%,#eef7ff_100%)] px-5 py-6 shadow-[0_18px_55px_rgba(37,99,235,0.09)]">
                <div className="pointer-events-none absolute right-8 top-7 hidden h-36 w-36 rounded-[34px] border border-white/80 bg-white/55 shadow-[0_24px_70px_rgba(37,99,235,0.16)] backdrop-blur-sm lg:block" />
                <div className="pointer-events-none absolute right-14 top-11 hidden h-24 w-24 rotate-[-8deg] place-items-center rounded-[28px] border border-blue-100 bg-[linear-gradient(155deg,#ffffff_0%,#dbeafe_100%)] text-4xl font-black text-primary shadow-[0_20px_50px_rgba(59,130,246,0.18)] lg:grid">
                  AI
                </div>
                <div className="pointer-events-none absolute right-4 top-4 hidden h-4 w-4 rounded-full bg-cyan-300/70 shadow-[0_0_22px_rgba(34,211,238,0.65)] lg:block" />

                <div className="relative grid gap-6 lg:grid-cols-[minmax(0,1fr)_230px]">
                  <div className="min-w-0">
                    <h2 className="max-w-[760px] text-[40px] font-black leading-tight text-slate-950">
                      Hi，我是你的 <span className="text-primary">绩效 AI 助手</span>。
                    </h2>
                    <p className="mt-4 max-w-[860px] whitespace-pre-line text-base font-semibold leading-8 text-slate-600">
                      {assistantHome.intro}
                    </p>

                    <VersionFourHomeTodoPanel
                      cycle={getReportGuideCycle(activeTab)}
                      roleCanReviewSubs={roleCanReviewSubs}
                      personalReportStatus={personalReportStatus}
                      directFeedbackSubs={pendingFeedbackDirectSubs}
                      directPendingSubmitCount={pendingSubmitDirectSubs.length}
                      indirectPendingSubmitCount={pendingSubmitIndirectSubs.length}
                      onPersonalTodo={startPersonalTodo}
                      onSingleFeedback={generateFeedbackForSub}
                      onBatchFeedback={startBatchFeedbackConfirm}
                      onShowPendingSubmit={startPendingSubmitTodo}
                      onRemindAll={remindPendingSubmitSubs}
                    />

                    <div className="mt-6 max-w-[620px]">
                      <p className="flex items-center gap-2 text-xs font-black text-slate-700">
                        <span className="h-4 w-1 rounded-full bg-primary" />
                        推荐提问
                      </p>
                      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-100 bg-white/90 shadow-[0_14px_35px_rgba(15,23,42,0.05)] backdrop-blur">
                        {assistantPrompts.slice(0, RECOMMENDED_PROMPT_LIMIT).map((prompt, index) => {
                          const PromptIcon = index === 0 ? ListChecks : index === 1 ? Bell : BookOpenText;
                          return (
                            <button
                              key={prompt.text}
                              type="button"
                              onClick={() => runAssistantPrompt(prompt)}
                              className="group flex min-h-[56px] w-full items-center gap-3 border-b border-slate-100 px-4 text-left transition last:border-b-0 hover:bg-primary-soft/55"
                            >
                              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
                                <PromptIcon className="h-4 w-4" />
                              </span>
                              <span className="min-w-0 flex-1 truncate text-sm font-black leading-tight text-slate-900">
                                {prompt.text}
                              </span>
                              <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-primary" />
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                  <div className="hidden min-h-[240px] items-center justify-center lg:flex">
                    <div className="relative h-44 w-44 rounded-full bg-[radial-gradient(circle_at_45%_35%,#ffffff_0%,#dbeafe_46%,#bfdbfe_100%)] shadow-[0_30px_75px_rgba(37,99,235,0.16)]">
                      <div className="absolute inset-7 rounded-full border border-white/80 bg-white/35" />
                      <Sparkles className="absolute left-1/2 top-1/2 h-12 w-12 -translate-x-1/2 -translate-y-1/2 text-primary" strokeWidth={2.6} />
                    </div>
                  </div>
                </div>
              </section>
              )}

              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className="max-w-[78%]">
                    <div className={`whitespace-pre-line rounded-2xl px-4 py-3 text-sm font-semibold leading-6 shadow-sm ${
                      message.role === "user"
                        ? "bg-primary text-white"
                        : "border border-slate-200 bg-white text-slate-700"
                    }`}>
                      {message.text}
                    </div>
                    {message.role === "assistant" && message.id === latestAssistantMessageId && shouldShowVersionFourFeedbackHistoryAction(message, activeMode) && (
                      <button
                        type="button"
                        onClick={askFeedbackHistorySummary}
                        className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg border border-primary/20 bg-white px-3 text-[11px] font-black text-primary shadow-sm transition hover:bg-primary-soft"
                      >
                        查看 1-4 月反馈总结
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {feedbackPickerVisible && (
                <VersionFourFeedbackSubPicker
                  subs={pendingFeedbackSubs}
                  onSelect={generateFeedbackForSub}
                  onBatchFeedback={startBatchFeedbackConfirm}
                />
              )}

              {batchFeedbackPhase && (
                <VersionFourBatchFeedbackPanel
                  phase={batchFeedbackPhase}
                  items={batchFeedbackItems}
                  activeItem={activeBatchItem}
                  cycle={getReportGuideCycle(activeTab)}
                  optimizingSubId={batchOptimizationSubId}
                  onStart={startBatchFeedbackGeneration}
                  onCancel={cancelBatchFeedback}
                  onView={showBatchFeedbackDetail}
                  onConfirm={(subId) => confirmBatchFeedbackItem(subId, false)}
                  onManualEdit={(subId) => {
                    setActiveBatchSubId(subId);
                    setBatchPreviewOpen(true);
                  }}
                  onNext={switchToNextBatchFeedback}
                  onBackToList={() => {
                    setBatchFeedbackPhase("ready");
                    setActiveBatchSubId(null);
                    setBatchOptimizationSubId(null);
                  }}
                  onOpenPreview={() => setBatchPreviewOpen(true)}
                />
              )}

              {pendingSubmitListVisible && (
                <VersionFourPendingSubmitList
                  subs={pendingSubmitSubs}
                  onRemindAll={remindPendingSubmitSubs}
                  onSelect={(sub) => selectTarget(sub.id)}
                />
              )}

              {newUserGuideVisible && (
                <VersionFourNewUserGuidePush
                  guideKind={demoRole === "new_manager" ? "feedback" : "summary"}
                  cycle={getReportGuideCycle(activeTab)}
                  onOpen={() => {
                    closeNewUserGuide();
                    onOpenMonthlyGuide(demoRole === "new_manager" ? "feedback" : "summary");
                  }}
                  onDismiss={closeNewUserGuide}
                />
              )}

              {generationGuideConfirm && (
                <VersionFourGenerationGuideConfirmCard
                  kind={generationGuideConfirm}
                  cycle={getReportGuideCycle(activeTab)}
                  onGuide={() => onOpenMonthlyGuide(generationGuideConfirm === "personal" ? "summary" : "feedback")}
                  onGenerate={() => {
                    if (generationGuideConfirm === "feedback") {
                      setGenerationGuideConfirm(null);
                      if (activeMode === "feedback" && activeSub) {
                        generateFeedbackForSub(activeSub);
                      } else {
                        startFeedbackPickerFromAssistant(cycle.isMidyear ? "帮我生成给下属的年中反馈" : "帮我生成给下属的月度反馈");
                      }
                      return;
                    }
                    chooseWriteMode("ai");
                  }}
                />
              )}

              {cycle.isMidyear && midyearSummarySub && (
                <VersionFourMidyearReportSummaryCard
                  sub={midyearSummarySub}
                  onGenerate={() => generateMidyearSupervisorFeedback(midyearSummarySub)}
                  onDetail={() => {
                    setDrawerTargetId(midyearSummarySub.id);
                    setDrawerExpanded(true);
                  }}
                  onHistory={() => {
                    setMessages((prev) => [
                      ...prev,
                      {
                        id: `midyear-history-${Date.now()}`,
                        role: "assistant",
                        text: `${midyearSummarySub.name}历史反馈摘要：1-6月反馈中多次体现执行稳定、协同较好和结果导向；同时需持续加强风险前置、过程复盘和跨部门闭环。`,
                      },
                    ]);
                  }}
                  onBack={() => {
                    setMidyearSummarySubId(null);
                    setFeedbackPickerVisible(true);
                  }}
                />
              )}

              {modeChoiceVisible && writeMode === "choice" && (
                <VersionFourModeChoiceCard
                  activeMode={activeMode}
                  targetName={activeMode === "report" ? CURRENT_USER.name : activeSub?.name ?? "该成员"}
                  cycle={getReportGuideCycle(activeTab)}
                  onDirect={() => chooseWriteMode("direct")}
                  onAi={requestAiGeneration}
                />
              )}

              {writeMode !== "choice" && (
                activeMode === "report" ? (
                  <VersionFourPersonalDraftCard
                    key={`report-${writeMode}-${revisionCount}`}
                    draft={writeMode === "direct" ? directPersonalDraft : personalDraft}
                    submittedReport={submittedPersonalReport}
                    status={personalReportStatus}
                    sourceMode={writeMode}
                    cycle={getReportGuideCycle(activeTab)}
                    onSwitchMode={(nextMode) => chooseWriteMode(nextMode)}
                    onRegenerate={() => setRevisionCount((count) => count + 1)}
                    onSaveDraft={savePersonalDraft}
                    onSubmit={(report) => setPreviewSubmission({ kind: "personal", report })}
                    onSubmitEmail={(report) => setPreviewSubmission({ kind: "personal", report })}
                  />
                ) : activeSub && feedbackDraft ? (
                  cycle.isMidyear && writeMode === "ai" ? (
                  <VersionFourMidyearFeedbackSummaryCard
                    key={`midyear-feedback-${activeSub.id}-${revisionCount}`}
                    sub={activeSub}
                    draft={feedbackDraft}
                    scoreMap={feedbackScoreMap}
                    onSubmit={(draft, scoreMap) => setPreviewSubmission({ kind: "feedback", sub: activeSub, draft, scoreMap })}
                    onSubmitEmail={(draft, scoreMap) => setPreviewSubmission({ kind: "feedback", sub: activeSub, draft, scoreMap })}
                    onBackToList={() => {
                      setWriteMode("choice");
                      setFeedbackPickerVisible(true);
                    }}
                    onNext={() => {
                      const nextSub = pendingFeedbackSubs.find((item) => item.id !== activeSub.id) ?? pendingFeedbackSubs[0];
                      if (nextSub) generateFeedbackForSub(nextSub);
                    }}
                  />
                  ) : (
                  <VersionFourFeedbackDraftCard
                    key={`feedback-${activeSub.id}-${writeMode}-${revisionCount}`}
                    sub={activeSub}
                    draft={writeMode === "direct" && directFeedbackDraft ? directFeedbackDraft : feedbackDraft}
                    scoreMap={feedbackScoreMap}
                    sourceMode={writeMode}
                    cycle={getReportGuideCycle(activeTab)}
                    onSwitchMode={(nextMode) => chooseWriteMode(nextMode)}
                    onRegenerate={() => setRevisionCount((count) => count + 1)}
                    onSaveDraft={(draft, scoreMap) => saveFeedbackDraft(activeSub, draft, scoreMap)}
                    onSubmit={(draft, scoreMap) => setPreviewSubmission({ kind: "feedback", sub: activeSub, draft, scoreMap })}
                    onSubmitEmail={(draft, scoreMap) => setPreviewSubmission({ kind: "feedback", sub: activeSub, draft, scoreMap })}
                  />
                  )
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-10 text-center text-sm font-semibold text-slate-500">
                    请先在左侧选择一个下属，我会基于该人员更新助手内容。
                  </div>
                )
              )}
            </div>
          </div>

          <div className="border-t border-slate-100 bg-white p-4">
            <div className="mx-auto flex max-w-4xl items-end gap-3 rounded-[22px] border border-primary/35 bg-white p-2 shadow-[0_14px_42px_rgba(47,102,217,0.10)]">
              <textarea
                value={chatInput}
                onChange={(event) => setChatInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage();
                  }
                }}
                rows={3}
                className="min-h-[80px] flex-1 resize-none bg-transparent px-3 py-2 text-sm font-bold leading-6 text-slate-800 outline-none placeholder:text-slate-400"
                placeholder="请将您遇到的问题告诉我，使用 Shift + Enter 换行"
              />
              <button
                type="button"
                onClick={sendMessage}
                className="mb-1 grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/65 text-white shadow-[0_10px_22px_rgba(47,102,217,0.22)] transition hover:bg-primary"
                aria-label="发送给 AI"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-3 text-center text-xs font-bold text-slate-500">内容由 AI 生成，仅供参考</p>
          </div>
          </>
          )}
        </main>

        </div>
      </div>
      {previewSubmission && (
        <GeneratedContentPreviewDialog
          title={previewSubmission.kind === "personal" ? `确认录入${cycle.personalReportName}` : `确认录入${previewSubmission.sub.name}${cycle.feedbackName}`}
          subtitle="请先核对内容，确认后可选择仅录入系统，或录入系统并发送邮件。"
          content={previewSubmission.kind === "personal" ? getPersonalReportPreviewText(previewSubmission.report, getReportGuideCycle(activeTab)) : getFeedbackText(previewSubmission.draft)}
          score={previewSubmission.kind === "personal" ? previewSubmission.report.score : previewSubmission.draft.score}
          sending={submittingPreview}
          onBack={() => setPreviewSubmission(null)}
          onSubmitSystem={() => confirmPreviewToSystem(false)}
          onSubmitEmail={() => confirmPreviewToSystem(true)}
        />
      )}
      {emailDraft && (
        <FeedbackEmailDialog
          draft={emailDraft}
          subName={emailSubName || CURRENT_USER.name}
          sending={false}
          onChange={setEmailDraft}
          onClose={() => setEmailDraft(null)}
          onConfirm={confirmEmailSend}
        />
      )}
      {batchPreviewOpen && (
        <VersionFourBatchFeedbackPreviewDialog
          items={batchFeedbackItems}
          activeSubId={activeBatchSubId}
          cycle={getReportGuideCycle(activeTab)}
          onSelect={setActiveBatchSubId}
          onChangeDraft={updateBatchFeedbackDraft}
          onChangeScore={updateBatchFeedbackScore}
          onSubmitSystem={(subId) => confirmBatchFeedbackItem(subId, false)}
          onSubmitEmail={(subId) => confirmBatchFeedbackItem(subId, true)}
          onNext={switchToNextBatchFeedback}
          onClose={() => setBatchPreviewOpen(false)}
        />
      )}
    </section>
  );
}

function VersionFourHomeTodoPanel({
  cycle = "monthly",
  roleCanReviewSubs,
  personalReportStatus,
  directFeedbackSubs,
  directPendingSubmitCount,
  indirectPendingSubmitCount,
  onPersonalTodo,
  onSingleFeedback,
  onBatchFeedback,
  onShowPendingSubmit,
  onRemindAll,
}: {
  cycle?: ReportGuideCycle;
  roleCanReviewSubs: boolean;
  personalReportStatus: PersonalMonthlyReportStatus;
  directFeedbackSubs: Subordinate[];
  directPendingSubmitCount: number;
  indirectPendingSubmitCount: number;
  onPersonalTodo: () => void;
  onSingleFeedback: (sub: Subordinate) => void;
  onBatchFeedback: (subs: Subordinate[]) => void;
  onShowPendingSubmit: () => void;
  onRemindAll: () => void;
}) {
  const isMidyear = cycle === "midyear";
  const personalPending = personalReportStatus === "pending_submit";
  const totalPendingSubmitCount = directPendingSubmitCount + indirectPendingSubmitCount;
  const reportLabel = isMidyear ? "个人年中汇报" : "个人月度汇报";
  const feedbackLabel = isMidyear ? "年中反馈" : "月度反馈";

  return (
    <section className="mt-6 max-w-5xl rounded-3xl border border-primary/15 bg-white/95 p-4 shadow-[0_18px_45px_rgba(37,99,235,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <p className="text-lg font-black text-slate-950">本期待办</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            {personalPending ? `${reportLabel}待提交` : `${reportLabel}已处理`}；{roleCanReviewSubs ? `${directFeedbackSubs.length} 位直接下属待写${feedbackLabel}` : "暂无下属反馈待办"}
          </p>
        </div>
        {roleCanReviewSubs && totalPendingSubmitCount > 0 && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onShowPendingSubmit}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition hover:border-primary/30 hover:bg-primary-soft hover:text-primary"
            >
              <ClipboardList className="h-3.5 w-3.5" />
              查看待提交 {totalPendingSubmitCount}
            </button>
            <button
              type="button"
              onClick={onRemindAll}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-slate-900 px-3 text-xs font-black text-white transition hover:bg-slate-800"
            >
              <Bell className="h-3.5 w-3.5" />
              一键催办
            </button>
          </div>
        )}
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[280px_minmax(0,1fr)]">
        <article className={`rounded-2xl border p-3 ${personalPending ? "border-primary/25 bg-primary-soft/45" : "border-success/15 bg-success-soft/30"}`}>
          <div className="flex items-start gap-3">
            <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${personalPending ? "bg-primary text-white" : "bg-success text-white"}`}>
              <FileText className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-slate-950">{reportLabel}</p>
              <p className="mt-1 text-xs font-semibold leading-5 text-slate-500">
                {personalPending ? "当前待提交，建议优先完成。" : personalReportStatus === "waiting_feedback" ? "已提交，等待主考反馈。" : "已完成主考反馈。"}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={onPersonalTodo}
                  className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-[11px] font-black text-white transition hover:bg-primary/90"
                >
                  {personalPending ? "去填写" : "查看"}
                </button>
              </div>
            </div>
          </div>
        </article>

        {roleCanReviewSubs ? (
          <article className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-950">直接下属</p>
                    <p className="mt-0.5 text-xs font-semibold text-slate-500">{directFeedbackSubs.length} 位待写{feedbackLabel}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onBatchFeedback(directFeedbackSubs)}
                    disabled={directFeedbackSubs.length === 0}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[11px] font-black text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45"
                  >
                    <ListChecks className="h-3.5 w-3.5" />
                    批量
                  </button>
                </div>
                <div className="mt-3 grid gap-2 lg:grid-cols-3">
                  {directFeedbackSubs.slice(0, 6).map((sub) => (
                    <div key={sub.id} className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-2 ring-1 ring-slate-100">
                      <Avatar initial={sub.initial} size="sm" src={getPersonAvatarUrl(sub.id, sub.name)} alt={sub.name} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-black text-slate-900">{sub.name}</p>
                        <p className="truncate text-[10px] font-semibold text-slate-500">{sub.title}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onSingleFeedback(sub)}
                        className="shrink-0 rounded-lg border border-primary/20 bg-white px-2.5 py-1.5 text-[11px] font-black text-primary transition hover:bg-primary-soft"
                      >
                        写反馈
                      </button>
                    </div>
                  ))}
                  {directFeedbackSubs.length > 6 && (
                    <button
                      type="button"
                      onClick={() => onBatchFeedback(directFeedbackSubs)}
                      className="rounded-xl border border-dashed border-primary/25 bg-white px-3 py-2 text-xs font-black text-primary transition hover:bg-primary-soft"
                    >
                      还有 {directFeedbackSubs.length - 6} 位，批量处理
                    </button>
                  )}
                  {directFeedbackSubs.length === 0 && (
                    <div className="rounded-xl border border-dashed border-slate-200 bg-white px-3 py-5 text-center text-xs font-bold text-slate-400 lg:col-span-3">
                      当前暂无直接下属待反馈
                    </div>
                  )}
                </div>
              </article>
        ) : (
          <article className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <p className="text-sm font-black text-slate-950">当前没有下属反馈待办</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">可先完成个人汇报，或查看汇报填写指南。</p>
          </article>
        )}
      </div>

      {roleCanReviewSubs && totalPendingSubmitCount > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-500">
          <span className="rounded-full bg-white px-2.5 py-1 text-slate-600 ring-1 ring-slate-100">待提交：直接下属 {directPendingSubmitCount}</span>
          <span className="rounded-full bg-white px-2.5 py-1 text-slate-600 ring-1 ring-slate-100">间接下属 {indirectPendingSubmitCount}</span>
          <span className="text-slate-400">可先催办，已提交后再集中反馈。</span>
        </div>
      )}
    </section>
  );
}

function VersionFourMiniStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "primary" | "warning" | "success";
}) {
  const toneClass = tone === "warning" ? "text-warning" : tone === "success" ? "text-success" : "text-primary";
  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50 px-2 py-2 text-center">
      <p className="text-[10px] font-black text-slate-400">{label}</p>
      <p className={`mt-0.5 truncate text-sm font-black ${toneClass}`}>{value}</p>
    </div>
  );
}

function VersionFourTodoCard({
  title,
  detail,
  value,
  action,
  secondaryAction,
  tone,
  onClick,
  onSecondaryClick,
}: {
  title: string;
  detail: string;
  value: string;
  action: string;
  secondaryAction?: string;
  tone: "primary" | "warning" | "slate";
  onClick: () => void;
  onSecondaryClick?: () => void;
}) {
  const valueClass = tone === "warning" ? "text-warning" : tone === "slate" ? "text-slate-600" : "text-primary";
  const buttonClass = tone === "warning"
    ? "bg-warning text-white hover:bg-warning/90"
    : tone === "slate"
      ? "bg-slate-900 text-white hover:bg-slate-800"
      : "bg-primary text-white hover:bg-primary/90";
  return (
    <article className="rounded-xl border border-slate-100 bg-white p-3 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-black text-slate-950">{title}</p>
          <p className="mt-1 line-clamp-2 text-[11px] font-semibold leading-4 text-slate-500">{detail}</p>
        </div>
        <span className={`shrink-0 text-sm font-black ${valueClass}`}>{value}</span>
      </div>
      <div className={`mt-3 grid gap-2 ${secondaryAction ? "grid-cols-2" : "grid-cols-1"}`}>
        <button
          type="button"
          onClick={onClick}
          className={`inline-flex h-8 items-center justify-center rounded-lg text-[11px] font-black transition ${buttonClass}`}
        >
          {action}
        </button>
        {secondaryAction && (
          <button
            type="button"
            onClick={onSecondaryClick}
            className="inline-flex h-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-[11px] font-black text-slate-700 transition hover:border-primary/25 hover:bg-primary-soft hover:text-primary"
          >
            {secondaryAction}
          </button>
        )}
      </div>
    </article>
  );
}

function VersionFourFeedbackSubPicker({
  subs,
  onSelect,
  onBatchFeedback,
}: {
  subs: Subordinate[];
  onSelect: (sub: Subordinate) => void;
  onBatchFeedback: (subs: Subordinate[]) => void;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => subs.map((sub) => sub.id));
  useEffect(() => {
    setSelectedIds((current) => {
      const validIds = new Set(subs.map((sub) => sub.id));
      const next = current.filter((id) => validIds.has(id));
      const normalized = next.length > 0 ? next : subs.map((sub) => sub.id);
      return normalized.length === current.length && normalized.every((id, index) => id === current[index]) ? current : normalized;
    });
  }, [subs]);
  const selectedSubs = subs.filter((sub) => selectedIds.includes(sub.id));
  const toggleSub = (subId: string) => {
    setSelectedIds((current) => current.includes(subId) ? current.filter((id) => id !== subId) : [...current, subId]);
  };

  return (
    <section className="max-w-[760px] rounded-2xl border border-primary/15 bg-white p-3 shadow-[0_14px_34px_rgba(47,102,217,0.07)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-950">选择已提交汇报的下属</p>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">可单人生成，也可勾选多人分批生成反馈初稿。</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setSelectedIds(subs.map((sub) => sub.id))}
            disabled={subs.length === 0}
            className="inline-flex h-8 items-center rounded-lg border border-primary/20 bg-white px-3 text-[11px] font-black text-primary transition hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-45"
          >
            全选
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            disabled={selectedIds.length === 0}
            className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-600 transition hover:border-primary/30 hover:bg-primary-soft hover:text-primary disabled:cursor-not-allowed disabled:opacity-45"
          >
            清空
          </button>
          <button
            type="button"
            onClick={() => onBatchFeedback(selectedSubs)}
            disabled={selectedSubs.length === 0}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[11px] font-black text-white shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <ListChecks className="h-3.5 w-3.5" />
            批量反馈 {selectedSubs.length}
          </button>
          <span className="rounded-full bg-warning-soft px-2.5 py-1 text-[11px] font-black text-warning">{subs.length} 人待反馈</span>
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {subs.map((sub) => (
          <div
            key={sub.id}
            className={`flex min-w-0 items-center gap-2 rounded-xl border px-2.5 py-2 transition ${
              selectedIds.includes(sub.id) ? "border-primary/35 bg-primary-soft/45" : "border-slate-100 bg-slate-50 hover:border-primary/25"
            }`}
          >
            <input
              type="checkbox"
              checked={selectedIds.includes(sub.id)}
              onChange={() => toggleSub(sub.id)}
              className="h-4 w-4 shrink-0 accent-primary"
              aria-label={`选择${sub.name}进行批量反馈`}
            />
            <Avatar initial={sub.initial} size="sm" src={getPersonAvatarUrl(sub.id, sub.name)} alt={sub.name} />
            <button type="button" onClick={() => onSelect(sub)} className="min-w-0 flex-1 text-left">
              <span className="block truncate text-xs font-black text-slate-900">{sub.name}</span>
              <span className="block truncate text-[10px] font-semibold text-slate-500">{sub.title}</span>
            </button>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          </div>
        ))}
      </div>
      {subs.length === 0 && (
        <div className="mt-3 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs font-bold text-slate-400">
          当前没有已提交待反馈的下属
        </div>
      )}
    </section>
  );
}

function VersionFourBatchFeedbackPanel({
  phase,
  items,
  activeItem,
  cycle = "monthly",
  optimizingSubId,
  onStart,
  onCancel,
  onView,
  onConfirm,
  onManualEdit,
  onNext,
  onBackToList,
  onOpenPreview,
}: {
  phase: VersionFourBatchFeedbackPhase;
  items: VersionFourBatchFeedbackItem[];
  activeItem: VersionFourBatchFeedbackItem | null;
  cycle?: ReportGuideCycle;
  optimizingSubId: string | null;
  onStart: () => void;
  onCancel: () => void;
  onView: (subId: string) => void;
  onConfirm: (subId: string) => void;
  onManualEdit: (subId: string) => void;
  onNext: () => void;
  onBackToList: () => void;
  onOpenPreview: () => void;
}) {
  const generatedCount = items.length;
  const confirmedCount = items.filter((item) => item.status === "confirmed").length;
  const sentCount = items.filter((item) => item.emailSent).length;
  const isMidyear = cycle === "midyear";

  if (phase === "confirm") {
    return (
      <section className="max-w-[760px] rounded-2xl border border-primary/15 bg-white p-4 shadow-[0_14px_34px_rgba(47,102,217,0.07)]">
        <p className="text-sm font-black text-slate-950">是否开始批量生成？</p>
        <p className="mt-2 whitespace-pre-line text-xs font-semibold leading-6 text-slate-600">
          {`将为当前 ${generatedCount} 位已提交${isMidyear ? "年中总结" : "月度汇报"}的下属批量生成${isMidyear ? "年中反馈建议" : "反馈初稿"}。\n\n为避免反馈内容混淆，系统会为每位下属分别生成独立反馈。生成后您可以逐个预览、逐个修订和录入系统。`}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onStart}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-4 text-xs font-black text-white transition hover:bg-primary/90"
          >
            <Sparkles className="h-3.5 w-3.5" />
            开始生成
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 transition hover:border-primary/30 hover:bg-primary-soft hover:text-primary"
          >
            取消
          </button>
        </div>
      </section>
    );
  }

  if (phase === "generating") {
    return (
      <section className="max-w-[760px] rounded-2xl border border-primary/15 bg-white p-4 shadow-[0_14px_34px_rgba(47,102,217,0.07)]">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          <p className="text-sm font-black text-slate-950">正在为 {generatedCount} 位下属生成月度反馈初稿，请稍候...</p>
        </div>
        <div className="mt-3 space-y-2">
          {items.map((item) => (
            <div key={item.sub.id} className="flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
              <span>{item.sub.name}</span>
              <span className="inline-flex items-center gap-1 text-primary">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                生成中
              </span>
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (phase === "complete") {
    return (
      <section className="max-w-[760px] rounded-2xl border border-success/20 bg-white p-4 shadow-[0_14px_34px_rgba(34,197,94,0.08)]">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-success-soft text-success">
            <Check className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-slate-950">本次批量反馈已处理完成</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <VersionFourBatchMetric label="共生成" value={`${generatedCount}人`} tone="primary" />
              <VersionFourBatchMetric label="已录入系统" value={`${confirmedCount}人`} tone="success" />
              <VersionFourBatchMetric label="已发送邮件" value={`${sentCount}人`} tone="warning" />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" onClick={onBackToList} className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-600 transition hover:border-primary/30 hover:bg-primary-soft hover:text-primary">
                查看处理记录
              </button>
              <button type="button" onClick={onCancel} className="inline-flex h-8 items-center rounded-lg bg-primary px-3 text-[11px] font-black text-white transition hover:bg-primary/90">
                返回对话
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (phase === "detail" && activeItem) {
    const isConfirmed = activeItem.status === "confirmed";
    return (
      <section className="max-w-[760px] rounded-2xl border border-primary/15 bg-white p-4 shadow-[0_14px_34px_rgba(47,102,217,0.07)]">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-black text-slate-950">当前正在查看【{activeItem.sub.name}】的{isMidyear ? "年中反馈建议" : "月度反馈初稿"}</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">您可以直接确认，也可以手动修订当前人员反馈。</p>
          </div>
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-black ${isConfirmed ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
            {isConfirmed ? "已录入" : "待录入"}
          </span>
        </div>
        {optimizingSubId === activeItem.sub.id && (
          <div className="mt-3 rounded-xl border border-primary/15 bg-primary-soft/35 px-3 py-2 text-xs font-bold leading-5 text-primary">
            当前正在修改【{activeItem.sub.name}】的反馈内容，修改不会影响其他人员。
          </div>
        )}
        <div className="mt-3 space-y-2 rounded-2xl bg-slate-50 p-3">
          <VersionFourBatchFeedbackSection label="亮点" text={activeItem.draft.highlights} tone="success" />
          <VersionFourBatchFeedbackSection label="不足" text={activeItem.draft.shortcomings} tone="warning" />
          <VersionFourBatchFeedbackSection label={activeItem.draft.approvalOpinion ? "下阶段建议" : "建议"} text={activeItem.draft.nextFocus} tone="primary" />
          {activeItem.draft.approvalOpinion && (
            <VersionFourBatchFeedbackSection label="审批意见" text={activeItem.draft.approvalOpinion} tone="muted" />
          )}
          <VersionFourBatchFeedbackSection label="评分依据" text={`结合本月 KPI 完成情况、关键工作推进情况及历史反馈，建议综合评分 ${activeItem.draft.score} 分。`} tone="muted" />
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={() => onConfirm(activeItem.sub.id)} disabled={isConfirmed} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[11px] font-black text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45">
            <Check className="h-3.5 w-3.5" />
            录入系统
          </button>
          <button type="button" onClick={() => onManualEdit(activeItem.sub.id)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-700 transition hover:border-primary/30 hover:bg-primary-soft hover:text-primary">
            <Pencil className="h-3.5 w-3.5" />
            手动修订
          </button>
          <button type="button" onClick={onNext} className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-700 transition hover:border-primary/30 hover:bg-primary-soft hover:text-primary">
            切换下一个
          </button>
          <button type="button" onClick={onBackToList} className="inline-flex h-8 items-center rounded-lg border border-slate-200 bg-white px-3 text-[11px] font-black text-slate-700 transition hover:border-primary/30 hover:bg-primary-soft hover:text-primary">
            返回列表
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-[760px] rounded-2xl border border-primary/15 bg-white p-4 shadow-[0_14px_34px_rgba(47,102,217,0.07)]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-950">批量反馈已生成</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">以下 {generatedCount} 位下属的反馈初稿已生成，请逐个查看、修订并录入系统。</p>
        </div>
        <button type="button" onClick={onOpenPreview} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[11px] font-black text-white transition hover:bg-primary/90">
          <PanelRight className="h-3.5 w-3.5" />
          批量预览
        </button>
      </div>
      <div className="mt-3 grid gap-2">
        {items.map((item) => (
          <article key={item.sub.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
            <div className="flex items-start gap-3">
              <Avatar initial={item.sub.initial} size="sm" src={getPersonAvatarUrl(item.sub.id, item.sub.name)} alt={item.sub.name} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-black text-slate-950">{item.sub.name}</p>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${item.status === "confirmed" ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
                    {item.status === "confirmed" ? "已录入" : "待录入"}
                  </span>
                </div>
                <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">
                  摘要：{item.draft.highlights}
                </p>
              </div>
              <button type="button" onClick={() => onView(item.sub.id)} className="shrink-0 rounded-lg border border-primary/20 bg-white px-3 py-1.5 text-[11px] font-black text-primary transition hover:bg-primary-soft">
                查看反馈
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function VersionFourBatchMetric({ label, value, tone }: { label: string; value: string; tone: "primary" | "success" | "warning" }) {
  const cls = tone === "success" ? "bg-success-soft text-success" : tone === "warning" ? "bg-warning-soft text-warning" : "bg-primary-soft text-primary";
  return (
    <div className={`rounded-xl px-3 py-2 ${cls}`}>
      <p className="text-[10px] font-black">{label}</p>
      <p className="mt-1 text-sm font-black">{value}</p>
    </div>
  );
}

function VersionFourBatchFeedbackSection({ label, text, tone }: { label: string; text: string; tone: "success" | "warning" | "primary" | "muted" }) {
  const cls =
    tone === "success"
      ? "text-success"
      : tone === "warning"
        ? "text-warning"
        : tone === "primary"
          ? "text-primary"
          : "text-slate-500";
  return (
    <div className="rounded-xl bg-white px-3 py-2 ring-1 ring-slate-100">
      <p className={`text-[11px] font-black ${cls}`}>{label}</p>
      <p className="mt-1 text-xs font-semibold leading-5 text-slate-700">{text}</p>
    </div>
  );
}

function VersionFourBatchFeedbackPreviewDialog({
  items,
  activeSubId,
  cycle = "monthly",
  onSelect,
  onChangeDraft,
  onChangeScore,
  onSubmitSystem,
  onSubmitEmail,
  onNext,
  onClose,
}: {
  items: VersionFourBatchFeedbackItem[];
  activeSubId: string | null;
  cycle?: ReportGuideCycle;
  onSelect: (subId: string) => void;
  onChangeDraft: (subId: string, patch: Partial<FeedbackDraft>) => void;
  onChangeScore: (subId: string, scoreId: string, value: string) => void;
  onSubmitSystem: (subId: string) => void;
  onSubmitEmail: (subId: string) => void;
  onNext: () => void;
  onClose: () => void;
}) {
  const activeItem = items.find((item) => item.sub.id === activeSubId) ?? items.find((item) => item.status !== "confirmed") ?? items[0] ?? null;
  const confirmedCount = items.filter((item) => item.status === "confirmed").length;
  const sentCount = items.filter((item) => item.emailSent).length;
  const allDone = items.length > 0 && confirmedCount === items.length;
  const isMidyear = cycle === "midyear";
  const midyearNavItems = [
    ["score", "核心KPI及关键工作评分"],
    ["overall", "综合评价"],
    ["model", "8Q+TEL"],
    ["capability", "综合能力和发展趋势"],
  ] as const;
  const [activeMidyearSection, setActiveMidyearSection] = useState<typeof midyearNavItems[number][0]>("overall");
  const activeMidyearSectionLabel = midyearNavItems.find(([key]) => key === activeMidyearSection)?.[1] ?? "综合评价";

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-slate-950/30 px-4 pt-10">
      <section className="flex max-h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_28px_90px_rgba(15,23,42,0.22)]">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 bg-primary-soft/45 px-5 py-4">
          <div>
            <p className="text-lg font-black text-slate-950">批量反馈预览</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">已为 {items.length} 位下属生成{isMidyear ? "年中主管反馈建议" : "反馈初稿"}。请逐个预览、逐个修订和逐个录入系统。</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-white hover:text-primary" aria-label="关闭批量反馈预览">
            <X className="h-4 w-4" />
          </button>
        </div>

        {allDone ? (
          <div className="min-h-0 flex-1 p-6">
            <div className="rounded-2xl border border-success/20 bg-white p-5 shadow-sm">
              <p className="text-lg font-black text-slate-950">批量反馈处理完成</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <VersionFourBatchMetric label="共生成" value={`${items.length}人`} tone="primary" />
                <VersionFourBatchMetric label="已录入系统" value={`${confirmedCount}人`} tone="success" />
                <VersionFourBatchMetric label="已发送邮件" value={`${sentCount}人`} tone="warning" />
              </div>
              <div className="mt-5 flex flex-wrap gap-2">
                <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-lg bg-primary px-4 text-xs font-black text-white transition hover:bg-primary/90">返回对话</button>
                <button type="button" onClick={onClose} className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-4 text-xs font-black text-slate-600 transition hover:border-primary/30 hover:bg-primary-soft hover:text-primary">查看处理记录</button>
              </div>
            </div>
          </div>
        ) : activeItem ? (
          <div className="grid min-h-0 flex-1 grid-cols-[240px_minmax(0,1fr)]">
            <aside className="min-h-0 overflow-y-auto border-r border-slate-100 bg-slate-50 p-3">
              <p className="px-1 pb-2 text-[11px] font-black text-slate-400">人员列表</p>
              <div className="space-y-2">
                {items.map((item) => {
                  const active = item.sub.id === activeItem.sub.id;
                  const midyearDetails = getMidyearFeedbackDetails(item.draft, item.scoreMap, item.sub.name);
                  return (
                    <button
                      key={item.sub.id}
                      type="button"
                      onClick={() => onSelect(item.sub.id)}
                      className={`flex w-full items-center gap-2 rounded-xl border px-2.5 py-2 text-left transition ${
                        active ? "border-primary bg-white shadow-sm" : "border-transparent bg-white/70 hover:border-primary/25"
                      }`}
                    >
                      <Avatar initial={item.sub.initial} size="sm" src={getPersonAvatarUrl(item.sub.id, item.sub.name)} alt={item.sub.name} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-black text-slate-900">{item.sub.name}</span>
                        <span className={`mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ${item.status === "confirmed" ? "bg-success-soft text-success" : "bg-warning-soft text-warning"}`}>
                          {item.status === "confirmed" ? "已录入" : "待录入"}
                        </span>
                        {isMidyear && (
                          <span className="mt-1 block truncate text-[10px] font-bold text-slate-500">
                            {midyearDetails.overall.score}｜{midyearDetails.capability}
                          </span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>
            <div className="flex min-h-0 flex-col">
              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-base font-black text-slate-950">
                      {activeItem.sub.name}｜{isMidyear ? "年中反馈建议" : activeItem.sub.title}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      {isMidyear
                        ? `当前查看「${activeMidyearSectionLabel}」模块，可切换上方标签逐项核对；修改仅作用于${activeItem.sub.name}。`
                        : "当前内容默认为可编辑状态，修改仅作用于该人员反馈。"}
                    </p>
                  </div>
                  <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-black text-primary">{activeItem.draft.score} 分</span>
                </div>
                {isMidyear && (
                  <div className="mt-4 grid gap-2 md:grid-cols-4">
                    {midyearNavItems.map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setActiveMidyearSection(key)}
                        className={`h-9 rounded-xl px-3 text-xs font-black transition ${
                          activeMidyearSection === key
                            ? "bg-primary text-white shadow-sm"
                            : "bg-primary-soft/70 text-primary hover:bg-primary-soft"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
                <div className="mt-4 grid gap-3">
                  {isMidyear && (
                    <div className="grid gap-2 md:grid-cols-4">
                      {(() => {
                        const details = getMidyearFeedbackDetails(activeItem.draft, activeItem.scoreMap, activeItem.sub.name);
                        return (
                          <>
                            <VersionFourMidyearBadge label="综合评分" value={`${details.overall.score}`} />
                            <VersionFourMidyearBadge label="综合能力" value={details.capability} />
                            <VersionFourMidyearBadge label="发展趋势" value={details.trend} />
                            <VersionFourMidyearBadge label="推荐等级" value={details.model.rating} />
                          </>
                        );
                      })()}
                    </div>
                  )}
                  {isMidyear ? (() => {
                    const details = getMidyearFeedbackDetails(activeItem.draft, activeItem.scoreMap, activeItem.sub.name);
                    const updateDetails = (nextDetails: MidyearSupervisorFeedback) => {
                      onChangeDraft(activeItem.sub.id, {
                        midyearFeedback: nextDetails,
                        highlights: nextDetails.overall.highlights,
                        shortcomings: nextDetails.overall.shortcomings,
                        nextFocus: nextDetails.overall.nextYearFocus,
                        score: nextDetails.overall.score,
                      });
                    };
                    if (activeMidyearSection === "score") {
                      return (
                        <div className="grid gap-3">
                          <VersionFourMidyearScoreEditor title="核心KPI评分" rows={details.kpiScores} onScoreChange={(scoreId, value) => onChangeScore(activeItem.sub.id, scoreId, value)} />
                          <VersionFourMidyearScoreEditor title="关键工作评分" rows={details.keyWorkScores} onScoreChange={(scoreId, value) => onChangeScore(activeItem.sub.id, scoreId, value)} />
                        </div>
                      );
                    }
                    if (activeMidyearSection === "model") {
                      return (
                        <section className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                          <p className="text-xs font-black text-slate-700">评估模型</p>
                          <p className="mt-1 text-[11px] font-semibold text-slate-500">按 8Q 与管理能力维度核对优势标签，勾选结果仅作用于当前下属。</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {MIDYEAR_RATINGS.map((rating) => (
                              <button
                                key={rating}
                                type="button"
                                onClick={() => updateDetails({ ...details, model: { ...details.model, rating } })}
                                className={`rounded-xl px-4 py-2 text-xs font-black ${details.model.rating === rating ? "bg-primary text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}
                              >
                                {rating}
                              </button>
                            ))}
                          </div>
                          <div className="mt-4 grid gap-3 lg:grid-cols-2">
                            {details.model.dimensions.map((dimension) => (
                              <div key={dimension.id} className="rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-100">
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-[11px] font-black text-slate-600">{dimension.label}</p>
                                  <span className="text-[11px] font-black text-primary">{dimension.score}</span>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-2">
                                  {getMidyearAbilityDimensionTags(dimension).map((tag) => {
                                    const checked = details.model.tags.includes(tag);
                                    return (
                                      <button
                                        key={`${dimension.id}-${tag}`}
                                        type="button"
                                        onClick={() => updateDetails({
                                          ...details,
                                          model: {
                                            ...details.model,
                                            tags: checked
                                              ? details.model.tags.filter((item) => item !== tag)
                                              : [...details.model.tags, tag],
                                          },
                                        })}
                                        className={`rounded-lg border px-3 py-1.5 text-[11px] font-black ${checked ? "border-primary bg-primary-soft text-primary" : "border-slate-200 bg-white text-slate-500"}`}
                                      >
                                        {checked ? "✓ " : ""}{tag}
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ))}
                          </div>
                        </section>
                      );
                    }
                    if (activeMidyearSection === "capability") {
                      return (
                        <section className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                          <p className="text-xs font-black text-slate-700">综合能力与趋势</p>
                          <p className="mt-1 text-[11px] font-semibold text-slate-500">切换能力和发展趋势后，会同步更新当前下属的年中反馈建议。</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {MIDYEAR_CAPABILITIES.map((capability) => (
                              <button key={capability} type="button" onClick={() => updateDetails({ ...details, capability })} className={`rounded-xl px-4 py-2 text-xs font-black ${details.capability === capability ? "bg-primary text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>{capability}</button>
                            ))}
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {MIDYEAR_TRENDS.map((trend) => (
                              <button key={trend} type="button" onClick={() => updateDetails({ ...details, trend })} className={`rounded-xl px-4 py-2 text-xs font-black ${details.trend === trend ? "bg-primary text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>{trend}</button>
                            ))}
                          </div>
                        </section>
                      );
                    }
                    return (
                      <>
                        <VersionFourBatchTextArea label="主要贡献及亮点评价" hint={`请核对${activeItem.sub.name}上半年贡献是否覆盖经营结果、重点项目和可复用经验。`} value={details.contributionReview} onChange={(value) => updateDetails({ ...details, contributionReview: value })} />
                        <VersionFourBatchTextArea label="不足及遗憾评价" hint="建议保留事实、影响和改进要求，避免只写笼统评价。" value={details.regretReview} onChange={(value) => updateDetails({ ...details, regretReview: value })} />
                        <VersionFourBatchTextArea label="亮点肯定" hint="请确认上半年阶段表现、目标达成和综合判断是否准确。" value={activeItem.draft.highlights} onChange={(value) => onChangeDraft(activeItem.sub.id, { highlights: value })} />
                        <VersionFourBatchTextArea label="不足提醒" hint="需指出目标差距、过程风险或协同问题。" value={activeItem.draft.shortcomings} onChange={(value) => onChangeDraft(activeItem.sub.id, { shortcomings: value })} />
                        <VersionFourBatchTextArea label="后续改进建议" hint="明确下半年优先级、里程碑和检查点。" value={activeItem.draft.nextFocus} onChange={(value) => onChangeDraft(activeItem.sub.id, { nextFocus: value })} />
                        {activeItem.draft.approvalOpinion && (
                          <VersionFourBatchTextArea label="审批意见" hint="确认同意提交、补充材料或后续跟进要求。" value={activeItem.draft.approvalOpinion} onChange={(value) => onChangeDraft(activeItem.sub.id, { approvalOpinion: value })} />
                        )}
                        <label className="block rounded-2xl border border-slate-100 bg-slate-50 p-3">
                          <span className="text-xs font-black text-slate-500">综合评分</span>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={activeItem.draft.score}
                            onChange={(event) => {
                              const score = normalizeScore(event.target.value);
                              if (score != null) onChangeDraft(activeItem.sub.id, { score });
                            }}
                            className="mt-2 h-9 w-24 rounded-lg border border-slate-200 bg-white text-center text-sm font-black text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                          />
                        </label>
                      </>
                    );
                  })() : (
                    <>
                      <VersionFourBatchTextArea label="亮点" value={activeItem.draft.highlights} onChange={(value) => onChangeDraft(activeItem.sub.id, { highlights: value })} />
                      <VersionFourBatchTextArea label="不足" value={activeItem.draft.shortcomings} onChange={(value) => onChangeDraft(activeItem.sub.id, { shortcomings: value })} />
                      <VersionFourBatchTextArea label={activeItem.draft.approvalOpinion ? "下阶段建议" : "建议"} value={activeItem.draft.nextFocus} onChange={(value) => onChangeDraft(activeItem.sub.id, { nextFocus: value })} />
                      {activeItem.draft.approvalOpinion && (
                        <VersionFourBatchTextArea label="审批意见" value={activeItem.draft.approvalOpinion} onChange={(value) => onChangeDraft(activeItem.sub.id, { approvalOpinion: value })} />
                      )}
                      <div className="grid gap-3">
                        <VersionFourBatchScoreBlock
                          title="核心 KPI"
                          summary={`加权主考 ${computeWeightedScore(KPI_SCORE_ITEMS, activeItem.scoreMap)}分`}
                          items={KPI_SCORE_ITEMS}
                          scoreMap={activeItem.scoreMap}
                          onScoreChange={(scoreId, value) => onChangeScore(activeItem.sub.id, scoreId, value)}
                        />
                        <VersionFourBatchScoreBlock
                          title="关键工作"
                          summary={`平均主考 ${computeAverageScore(KEY_WORK_SCORE_ITEMS, activeItem.scoreMap)}分`}
                          items={KEY_WORK_SCORE_ITEMS}
                          scoreMap={activeItem.scoreMap}
                          onScoreChange={(scoreId, value) => onChangeScore(activeItem.sub.id, scoreId, value)}
                        />
                      </div>
                      <label className="block rounded-2xl border border-slate-100 bg-slate-50 p-3">
                        <span className="text-xs font-black text-slate-500">综合评分</span>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={activeItem.draft.score}
                          onChange={(event) => {
                            const score = normalizeScore(event.target.value);
                            if (score != null) onChangeDraft(activeItem.sub.id, { score });
                          }}
                          className="mt-2 h-9 w-24 rounded-lg border border-slate-200 bg-white text-center text-sm font-black text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                        />
                      </label>
                    </>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-4 gap-2 border-t border-slate-100 bg-white p-4">
                <button type="button" onClick={onClose} className="rounded-xl border border-primary/25 bg-white px-3 py-2.5 text-xs font-black text-primary transition hover:bg-primary-soft">返回对话</button>
                <button type="button" onClick={() => onSubmitSystem(activeItem.sub.id)} disabled={activeItem.status === "confirmed"} className="rounded-xl bg-primary px-3 py-2.5 text-xs font-black text-white transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-45">录入系统</button>
                <button type="button" onClick={() => onSubmitEmail(activeItem.sub.id)} disabled={activeItem.status === "confirmed"} className="rounded-xl border border-primary/25 bg-white px-3 py-2.5 text-xs font-black text-primary transition hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-45">录入系统并发送邮件</button>
                <button type="button" onClick={onNext} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-black text-slate-600 transition hover:border-primary/30 hover:bg-primary-soft hover:text-primary">切换至下一个</button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </div>,
    document.body,
  );
}

function VersionFourBatchTextArea({ label, hint, value, onChange }: { label: string; hint?: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block rounded-2xl border border-slate-100 bg-slate-50 p-3">
      <span className="text-xs font-black text-slate-500">{label}</span>
      {hint && <span className="mt-1 block text-[11px] font-semibold leading-5 text-slate-400">{hint}</span>}
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        rows={4}
        className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold leading-5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}

function VersionFourBatchScoreBlock({
  title,
  summary,
  items,
  scoreMap,
  onScoreChange,
}: {
  title: string;
  summary: string;
  items: Array<typeof SCORE_ITEMS[number]>;
  scoreMap: Record<string, number>;
  onScoreChange: (id: string, value: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-black text-slate-700">{title}</span>
        <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-primary ring-1 ring-slate-100">
          {summary}
        </span>
      </div>
      <div className="mt-3 overflow-hidden rounded-xl border border-slate-100 bg-white">
        <table className="w-full table-fixed text-left">
          <colgroup>
            <col className="w-14" />
            <col />
            <col className="w-24" />
            <col className="w-28" />
          </colgroup>
          <thead className="bg-slate-100/70 text-[11px] font-black text-slate-500">
            <tr>
              <th className="px-3 py-2 text-center">序号</th>
              <th className="px-3 py-2">{title}</th>
              <th className="px-3 py-2 text-center">自评分</th>
              <th className="px-3 py-2 text-center">主管评分</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item, index) => (
              <tr key={item.id} className="text-xs font-semibold text-slate-700">
                <td className="px-3 py-2 text-center text-slate-500">{index + 1}</td>
                <td className="px-3 py-2">
                  <p className="truncate font-black text-slate-800">{item.title}</p>
                  {"weight" in item && item.weight ? (
                    <p className="mt-0.5 text-[10px] font-bold text-slate-400">权重 {item.weight}</p>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-center text-slate-500">{item.self}</td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={scoreMap[item.id] ?? item.self}
                    onChange={(event) => onScoreChange(item.id, event.target.value)}
                    className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-center text-xs font-black text-primary outline-none focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                    aria-label={`${item.title}主考评分`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function VersionFourPendingSubmitList({
  subs,
  onRemindAll,
  onSelect,
}: {
  subs: Subordinate[];
  onRemindAll: () => void;
  onSelect: (sub: Subordinate) => void;
}) {
  return (
    <section className="max-w-[760px] rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-slate-950">待提交下属名单</p>
          <p className="mt-0.5 text-xs font-semibold text-slate-500">共 {subs.length} 人，点击人员可查看绩效详情。</p>
        </div>
        <button
          type="button"
          onClick={onRemindAll}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-3 text-[11px] font-black text-white transition hover:bg-slate-800"
        >
          <Bell className="h-3.5 w-3.5" />
          一键催办
        </button>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {subs.slice(0, 12).map((sub) => (
          <button
            key={sub.id}
            type="button"
            onClick={() => onSelect(sub)}
            className="flex min-w-0 items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-2 text-left transition hover:border-primary/25 hover:bg-primary-soft/35"
          >
            <Avatar initial={sub.initial} size="sm" src={getPersonAvatarUrl(sub.id, sub.name)} alt={sub.name} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-black text-slate-900">{sub.name}</span>
              <span className="block truncate text-[10px] font-semibold text-slate-500">{sub.title}</span>
            </span>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
          </button>
        ))}
      </div>
      {subs.length > 12 && (
        <p className="mt-2 text-center text-[11px] font-semibold text-slate-400">已展示前 12 人，可在左侧筛选中继续查看全部名单。</p>
      )}
    </section>
  );
}

function VersionFourTargetButton({
  selected,
  name,
  title,
  avatar,
  badge,
  meta,
  showMeta = true,
  collapsed = false,
  onClick,
}: {
  selected: boolean;
  name: string;
  title: string;
  avatar: string;
  badge: string;
  meta: string;
  showMeta?: boolean;
  collapsed?: boolean;
  onClick: () => void;
}) {
  const [tooltipPosition, setTooltipPosition] = useState<{ x: number; y: number } | null>(null);
  const showCollapsedTooltip = (target: HTMLElement) => {
    if (!collapsed) return;
    const rect = target.getBoundingClientRect();
    setTooltipPosition({ x: rect.right + 12, y: rect.top + rect.height / 2 });
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        onMouseEnter={(event) => showCollapsedTooltip(event.currentTarget)}
        onMouseLeave={() => setTooltipPosition(null)}
        onFocus={(event) => showCollapsedTooltip(event.currentTarget)}
        onBlur={() => setTooltipPosition(null)}
        aria-label={collapsed ? `${name}，${title}，${badge}` : undefined}
        className={`group relative w-full rounded-xl border transition ${
          selected
            ? "border-primary bg-primary-soft/40 shadow-[0_12px_28px_rgba(47,102,217,0.10)]"
            : "border-slate-100 bg-white hover:border-primary/25 hover:bg-primary-soft/20"
        } ${collapsed ? "grid h-12 place-items-center px-0 py-0" : "px-3 py-2.5 text-left"}`}
      >
        <div className={`flex min-w-0 items-center ${collapsed ? "justify-center" : "gap-2.5"}`}>
          <img src={avatar} alt={name} className="h-9 w-9 shrink-0 rounded-xl object-cover ring-1 ring-white" />
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <p className="truncate text-sm font-black text-slate-900">{name}</p>
                  <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-black text-slate-500 ring-1 ring-slate-100">
                    {badge}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">{title}</p>
              </div>
              {showMeta && (
                <span className={`shrink-0 rounded-lg px-2 py-1 text-[10px] font-black ${
                  selected ? "bg-primary text-white" : "bg-slate-100 text-slate-500 group-hover:bg-white"
                }`}>
                  {meta}
                </span>
              )}
            </>
          )}
          {collapsed && (
            <span className={`absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full ring-2 ring-white ${
              badge === "待反馈" ? "bg-warning" : badge === "已确认" ? "bg-success" : "bg-primary"
            }`} />
          )}
        </div>
      </button>
      {collapsed && tooltipPosition && createPortal(
        <div
          className="pointer-events-none fixed z-[90] w-56 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left shadow-[0_18px_42px_rgba(15,23,42,0.18)]"
          style={{ left: tooltipPosition.x, top: tooltipPosition.y, transform: "translateY(-50%)" }}
          role="tooltip"
        >
          <span className="absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rotate-45 border-b border-l border-slate-200 bg-white" />
          <span className="block truncate text-sm font-black text-slate-950">{name}</span>
          <span className="mt-1 block line-clamp-2 text-xs font-semibold leading-5 text-slate-500">{title}</span>
          <span className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-black text-slate-500">
            {badge}
          </span>
        </div>,
        document.body,
      )}
    </>
  );
}

function VersionFourGuideMenu({
  cycle = "monthly",
  onOpenGuide,
}: {
  cycle?: ReportGuideCycle;
  onOpenGuide: (kind?: MonthlyGuideKind) => void;
}) {
  const summaryLabel = cycle === "midyear" ? "年中绩效总结填写指南" : "月度绩效总结指南";
  const feedbackLabel = cycle === "midyear" ? "年中绩效反馈指南" : "月度绩效反馈指南";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-xs font-black text-slate-500 transition hover:bg-primary-soft hover:text-primary"
          title="指南"
          aria-label="查看指南"
        >
          <BookOpenText className="h-4 w-4" />
          指南
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-56 rounded-xl border-slate-200 p-2 shadow-xl">
        <button
          type="button"
          onClick={() => onOpenGuide("summary")}
          className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-black text-slate-700 transition hover:bg-primary-soft hover:text-primary"
        >
          {summaryLabel}
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
        </button>
        <button
          type="button"
          onClick={() => onOpenGuide("feedback")}
          className="mt-1 flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-black text-slate-700 transition hover:bg-primary-soft hover:text-primary"
        >
          {feedbackLabel}
          <ChevronRight className="h-3.5 w-3.5 text-slate-400" />
        </button>
      </PopoverContent>
    </Popover>
  );
}

function MonthlyGuideHint({ field }: { field: MonthlyGuideHintField }) {
  const hint = MONTHLY_GUIDE_HINTS[field];
  const triggerRef = useRef<HTMLSpanElement>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState<{ left: number; top: number } | null>(null);

  const clearCloseTimer = () => {
    if (closeTimerRef.current == null) return;
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  };

  const openTooltip = () => {
    clearCloseTimer();
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltipPosition({
      left: rect.left + rect.width / 2,
      top: rect.bottom + 8,
    });
  };

  const closeTooltip = () => {
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      setTooltipPosition(null);
      closeTimerRef.current = null;
    }, 120);
  };

  useEffect(() => () => clearCloseTimer(), []);

  return (
    <span className="inline-flex">
      <span
        ref={triggerRef}
        onMouseEnter={openTooltip}
        onMouseLeave={closeTooltip}
        onFocus={openTooltip}
        onBlur={() => setTooltipPosition(null)}
        tabIndex={0}
        className="grid h-5 w-5 cursor-help place-items-center rounded-full border border-primary/25 bg-white text-primary shadow-sm transition hover:border-primary/45 hover:bg-primary-soft focus:border-primary/45 focus:bg-primary-soft focus:outline-none focus:ring-2 focus:ring-primary/15"
        aria-label={`${hint.title}填写要求`}
      >
        <CircleHelp className="h-3.5 w-3.5" />
      </span>
      {tooltipPosition && createPortal(
        <span
          className="fixed z-[10000] block w-[300px] max-w-[calc(100vw-32px)] -translate-x-1/2 rounded-xl border border-slate-200 bg-white p-3 text-left shadow-[0_18px_46px_rgba(15,23,42,0.18)]"
          style={{ left: tooltipPosition.left, top: tooltipPosition.top }}
          onMouseEnter={clearCloseTimer}
          onMouseLeave={closeTooltip}
          role="tooltip"
        >
          <span className="absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rotate-45 border-l border-t border-slate-200 bg-white" />
          <span className="relative block text-xs font-black text-slate-950">{hint.title}</span>
          <span className="relative mt-2 block space-y-1.5">
            {hint.items.map((item) => (
              <span key={item} className="flex gap-2 text-[11px] font-semibold leading-5 text-slate-600">
                <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/70" />
                <span>{item}</span>
              </span>
            ))}
          </span>
          {hint.example && (
            <span className="relative mt-2 block rounded-lg bg-slate-50 px-2.5 py-2 text-[11px] font-bold leading-5 text-slate-500">
              {hint.example}
            </span>
          )}
        </span>,
        document.body,
      )}
    </span>
  );
}

function VersionFourNewUserGuidePush({
  guideKind,
  cycle = "monthly",
  onOpen,
  onDismiss,
}: {
  guideKind: MonthlyGuideKind;
  cycle?: ReportGuideCycle;
  onOpen: () => void;
  onDismiss: () => void;
}) {
  const isMidyear = cycle === "midyear";
  const title = guideKind === "feedback"
    ? `我看你是首次处理${isMidyear ? "年中绩效反馈" : "月度绩效反馈"}`
    : `我看你是首次使用${isMidyear ? "年中汇报" : "月度汇报"}流程`;
  const detail = guideKind === "feedback"
    ? isMidyear
      ? "建议先看一遍年中反馈指南，里面有整体评价、亮点肯定、不足提醒、下阶段建议和审批意见的反馈口径。看完后你可以继续选择下属生成反馈草稿。"
      : "建议先看一遍反馈指南，里面有评分标准、工作亮点、不足和下月重点的反馈口径。看完后你可以继续选择自己填写或让我帮你生成反馈草稿。"
    : isMidyear
      ? "建议先看一遍年中总结填写指南，里面有核心KPI、关键工作、主要贡献、不足反思和自评分要求。看完后你可以直接生成草稿。"
      : "建议先看一遍总结指南，里面有月度汇报结构、自评要求和综合汇报写法。看完后你可以继续选择自己填写或让我帮你生成草稿。";
  const actionText = guideKind === "feedback" ? "查看反馈指南" : "查看总结指南";
  return (
    <div className="flex justify-start">
      <div className="max-w-[680px] rounded-2xl border border-primary/15 bg-white px-4 py-4 shadow-[0_16px_38px_rgba(47,102,217,0.08)]">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
            <BookOpenText className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-black text-slate-950">{title}</p>
            <p className="mt-1 text-xs font-semibold leading-6 text-slate-600">
              {detail}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={onOpen}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-black text-white transition hover:bg-primary/90"
              >
                <BookOpenText className="h-3.5 w-3.5" />
                {actionText}
              </button>
              <button
                type="button"
                onClick={onDismiss}
                className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-500 transition hover:border-primary/30 hover:bg-primary-soft hover:text-primary"
              >
                先不用
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function VersionFourGenerationGuideConfirmCard({
  kind,
  cycle = "monthly",
  onGuide,
  onGenerate,
}: {
  kind: "personal" | "feedback";
  cycle?: ReportGuideCycle;
  onGuide: () => void;
  onGenerate: () => void;
}) {
  const isMidyear = cycle === "midyear";
  const isFeedback = kind === "feedback";
  const title = isFeedback
    ? `生成${isMidyear ? "年中反馈" : "月度反馈"}初稿前，请选择下一步`
    : `生成个人${isMidyear ? "年中汇报" : "月度汇报"}初稿前，请选择下一步`;
  const detail = isFeedback
    ? isMidyear
      ? "AI 将基于下属年中总结、核心KPI、关键工作、1-6月月度汇报、历史反馈和附件材料生成反馈初稿。"
      : "AI 将基于下属月度汇报、核心KPI、关键工作和历史反馈生成反馈初稿。"
    : isMidyear
      ? "AI 将基于核心KPI、关键工作、1-6月月度汇报、历史主管反馈和附件材料生成初稿。"
      : "AI 将基于本期绩效目标、年度计划、上月汇报和历史上级反馈生成初稿。";
  return (
    <article className="max-w-3xl rounded-2xl border border-primary/15 bg-white p-4 shadow-[0_12px_30px_rgba(47,102,217,0.07)]">
      <div className="flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-950">{title}</p>
          <p className="mt-1 text-xs font-semibold leading-6 text-slate-500">
            {detail}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onGuide}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-primary/25 bg-white px-3 text-xs font-black text-primary transition hover:bg-primary-soft"
            >
              <BookOpenText className="h-3.5 w-3.5" />
              {isFeedback ? "查看反馈指南" : "查看填写指南"}
            </button>
            <button
              type="button"
              onClick={onGenerate}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-black text-white transition hover:bg-primary/90"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {isFeedback ? "直接生成反馈" : "直接生成初稿"}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

function VersionFourMidyearReportSummaryCard({
  sub,
  onGenerate,
  onDetail,
  onHistory,
  onBack,
}: {
  sub: Subordinate;
  onGenerate: () => void;
  onDetail: () => void;
  onHistory: () => void;
  onBack: () => void;
}) {
  const data = SAMPLE_SUB_DATA_BY_ID[sub.id];
  return (
    <article className="max-w-4xl rounded-2xl border border-primary/15 bg-white p-4 shadow-[0_14px_34px_rgba(47,102,217,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Avatar initial={sub.initial} size="md" src={getPersonAvatarUrl(sub.id, sub.name)} alt={sub.name} />
          <div>
            <p className="text-sm font-black text-slate-950">{sub.name}｜年中汇报摘要</p>
            <p className="mt-1 text-xs font-semibold text-slate-500">AI 已读取核心KPI、关键工作、主要贡献、不足及历史反馈材料。</p>
          </div>
        </div>
        <span className="rounded-full bg-warning-soft px-3 py-1 text-xs font-black text-warning">待生成主管反馈</span>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <VersionFourMidyearSummaryTile title="核心 KPI" value="共 5 项，月度自评平均分约 84 分" detail={data?.monthly_report?.highlights ?? "员工围绕经营指标、成本质量和客户经营进行了阶段性总结。"} />
        <VersionFourMidyearSummaryTile title="关键工作" value="共 6 项，覆盖重点项目与组织协同" detail={data?.monthly_report?.next_plan ?? "主要涉及企康运营、HS项目、健康险、数字营销和AI组织转型。"} />
        <VersionFourMidyearSummaryTile title="主要贡献及亮点" value="经营推进、流程优化、团队协同" detail="上半年在业绩达成、重点项目推动和组织协同方面有阶段性成果，部分成果可进一步用数据佐证。" />
        <VersionFourMidyearSummaryTile title="不足及遗憾" value="资源协调、目标拆解、过程复盘" detail={data?.monthly_report?.shortcomings ?? "员工主要反思了资源协调、目标拆解和部分事项推进不及预期的问题。"} />
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onGenerate} className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-black text-white transition hover:bg-primary/90">
          <Sparkles className="h-3.5 w-3.5" />
          生成主管反馈
        </button>
        <button type="button" onClick={onDetail} className="inline-flex h-9 items-center rounded-lg border border-primary/25 bg-white px-3 text-xs font-black text-primary transition hover:bg-primary-soft">查看年中汇报详情</button>
        <button type="button" onClick={onHistory} className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition hover:border-primary/30 hover:bg-primary-soft hover:text-primary">查看历史反馈</button>
        <button type="button" onClick={onBack} className="inline-flex h-9 items-center rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition hover:border-primary/30 hover:bg-primary-soft hover:text-primary">返回人员列表</button>
      </div>
    </article>
  );
}

function VersionFourMidyearSummaryTile({ title, value, detail }: { title: string; value: string; detail: string }) {
  return (
    <section className="rounded-xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-xs font-black text-slate-800">{title}</p>
      <p className="mt-1 text-[11px] font-black text-primary">{value}</p>
      <p className="mt-2 line-clamp-3 text-xs font-semibold leading-5 text-slate-500">{detail}</p>
    </section>
  );
}

function VersionFourModeChoiceCard({
  activeMode,
  targetName,
  cycle = "monthly",
  onDirect,
  onAi,
}: {
  activeMode: "report" | "feedback";
  targetName: string;
  cycle?: ReportGuideCycle;
  onDirect: () => void;
  onAi: () => void;
}) {
  const isMidyear = cycle === "midyear";
  const taskText = activeMode === "report" ? (isMidyear ? "个人年中汇报" : "个人月度汇报") : `${targetName}的${isMidyear ? "年中反馈" : "主考反馈"}`;
  return (
    <article className="max-w-3xl rounded-2xl border border-primary/15 bg-white p-4 shadow-[0_12px_30px_rgba(47,102,217,0.07)]">
      <div className="flex items-start gap-2.5">
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-slate-900 text-white">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-black text-slate-950">这次{taskText}，你想怎么完成？</p>
          <p className="mt-1 text-[11px] font-semibold leading-5 text-slate-500">
            你可以自己从空白表单开始填写，也可以让我先生成一版，再通过对话继续调整内容和评分。
          </p>
        </div>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2">
        <button
          type="button"
          onClick={onDirect}
          className="flex min-h-[56px] items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left transition hover:border-primary/30 hover:bg-primary-soft/30"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-primary shadow-sm ring-1 ring-slate-100">
            <Pencil className="h-4 w-4" />
          </span>
          <span className="flex min-w-0 flex-1 items-baseline gap-2">
            <span className="shrink-0 text-xs font-black text-slate-950">自主填写</span>
            <span className="min-w-0 truncate text-[11px] font-semibold text-slate-500">{isMidyear ? "手动录入年中总结字段、反馈意见和评分。" : "打开直接填写页面，手动录入综合汇报、指标说明和评分。"}</span>
          </span>
        </button>
        <button
          type="button"
          onClick={onAi}
          className="flex min-h-[56px] items-center gap-3 rounded-xl border border-primary/25 bg-primary px-3 py-2.5 text-left text-white shadow-[0_12px_28px_rgba(47,102,217,0.16)] transition hover:bg-primary/90"
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/15 text-white ring-1 ring-white/20">
            <Sparkles className="h-4 w-4" />
          </span>
          <span className="flex min-w-0 flex-1 items-baseline gap-2">
            <span className="shrink-0 text-xs font-black">智能辅助生成</span>
            <span className="min-w-0 truncate text-[11px] font-semibold text-white/82">{isMidyear ? "按年中绩效字段生成完整初稿，再核对事实与附件依据。" : "先生成完整草稿，再通过对话补充事实、调整口径和修改分数。"}</span>
          </span>
        </button>
      </div>
    </article>
  );
}

function VersionFourPersonalDraftCard({
  draft,
  submittedReport,
  status,
  sourceMode,
  cycle = "monthly",
  onSwitchMode,
  onRegenerate,
  onSaveDraft,
  onSubmit,
  onSubmitEmail,
}: {
  draft: PersonalReport;
  submittedReport?: SubmittedPersonalMonthlyReport;
  status: PersonalMonthlyReportStatus;
  sourceMode: Exclude<VersionFourWriteMode, "choice">;
  cycle?: ReportGuideCycle;
  onSwitchMode: (mode: Exclude<VersionFourWriteMode, "choice">) => void;
  onRegenerate: () => void;
  onSaveDraft?: (report: PersonalReport) => void;
  onSubmit: (report: PersonalReport) => void;
  onSubmitEmail: (report: PersonalReport) => void;
}) {
  const [summary, setSummary] = useState(submittedReport?.report.original ?? draft.summary);
  const [items, setItems] = useState<PersonalReport["items"]>(() => draft.items.map((item) => ({ ...item })));
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const summaryRef = useRef<HTMLTextAreaElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const statusText = status === "pending_submit" ? "待提交" : status === "waiting_feedback" ? "等待主考反馈" : "主考已反馈";
  const isMidyear = cycle === "midyear";
  const editable = sourceMode === "direct";
  const updateItem = (id: string, patch: Partial<PersonalReport["items"][number]>) => {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item));
  };
  const weightSum = PERSONAL_ITEMS.reduce((sum, item) => sum + (item.w ?? 0), 0);
  const editedScore = weightSum
    ? Math.round(items.reduce((sum, item) => {
      const source = PERSONAL_ITEMS.find((personalItem) => personalItem.id === item.id);
      return item.tag === "核心KPI" ? sum + item.score * (source?.w ?? 0) : sum;
    }, 0) / weightSum)
    : draft.score;
  const kpiItems = items.filter((item) => item.tag === "核心KPI");
  const keyWorkItems = items.filter((item) => item.tag === "关键工作");
  const [midyearDetails, setMidyearDetails] = useState<MidyearReportDetails>(() => cloneMidyearReportDetails(draft.midyear));
  const updateContribution = (key: keyof MidyearReportDetails["contributions"], value: string) => {
    setMidyearDetails((prev) => ({
      ...prev,
      contributions: { ...prev.contributions, [key]: value },
    }));
  };
  const updateRegret = (index: number, value: string) => {
    setMidyearDetails((prev) => ({
      ...prev,
      regrets: prev.regrets.map((item, itemIndex) => itemIndex === index ? value : item),
    }));
  };
  const addRegret = () => {
    setMidyearDetails((prev) => ({ ...prev, regrets: [...prev.regrets, "请补充不足、原因和下半年改进动作。"] }));
  };
  const uploadAttachments = (files: FileList | null) => {
    if (!files?.length) return;
    const uploaded = Array.from(files).map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${Date.now()}`,
      name: file.name,
      size: file.size,
      type: file.type || "未知类型",
      lastModified: file.lastModified,
    }));
    setMidyearDetails((prev) => ({ ...prev, attachments: [...prev.attachments, ...uploaded] }));
    if (attachmentInputRef.current) attachmentInputRef.current.value = "";
    toast.success(`已上传 ${uploaded.length} 个附件`);
  };
  const removeAttachment = (id: string) => {
    setMidyearDetails((prev) => ({ ...prev, attachments: prev.attachments.filter((file) => file.id !== id) }));
  };
  const editedReport = (): PersonalReport => ({
    ...draft,
    summary,
    score: editedScore,
    items,
    midyear: isMidyear ? midyearDetails : draft.midyear,
  });

  return (
    <>
    <article className="rounded-2xl border border-primary/15 bg-white p-4 shadow-[0_16px_40px_rgba(47,102,217,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary-soft text-primary">
              <FileText className="h-4 w-4" />
            </span>
            <p className="text-sm font-black text-slate-950">{sourceMode === "direct" ? `直接填写个人${isMidyear ? "年中汇报" : "月度汇报"}` : `AI 生成的个人${isMidyear ? "年中汇报" : "月度汇报"}`}</p>
            <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-black text-primary">{statusText}</span>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">{isMidyear ? "2026年中绩效" : getCurrentMonthPeriod()} · 当前自评分 {editedScore} 分</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sourceMode === "ai" && (
            <button
              type="button"
              onClick={() => onSwitchMode("direct")}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-primary/20 bg-primary-soft/50 px-3 text-xs font-black text-primary transition hover:bg-primary-soft"
            >
              <Pencil className="h-3.5 w-3.5" />
              切换自主填写
            </button>
          )}
          {sourceMode === "ai" && (
            <button
              type="button"
              onClick={() => setRevisionDialogOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition hover:border-primary/30 hover:bg-primary-soft hover:text-primary"
            >
              <Pencil className="h-3.5 w-3.5" />
              {isMidyear ? "手动修订" : "修订"}
            </button>
          )}
          {sourceMode === "direct" && (
            <>
              {onSaveDraft && (
                <button
                  type="button"
                  onClick={() => onSaveDraft(editedReport())}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition hover:border-primary/30 hover:bg-primary-soft hover:text-primary"
                >
                  <FileText className="h-3.5 w-3.5" />
                  保存草稿
                </button>
              )}
              <button
                type="button"
                onClick={() => onSubmit(editedReport())}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-primary/25 bg-white px-3 text-xs font-black text-primary transition hover:bg-primary-soft"
              >
                <Check className="h-3.5 w-3.5" />
                录入系统
              </button>
              <button
                type="button"
                onClick={() => onSubmitEmail(editedReport())}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-black text-white transition hover:bg-primary/90"
              >
                <Mail className="h-3.5 w-3.5" />
                录入系统并发送邮件
              </button>
            </>
          )}
        </div>
      </div>

      {!isMidyear && (
        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-black text-slate-800">综合汇报</p>
              <MonthlyGuideHint field="summary" />
            </div>
            <div className="flex items-center gap-2">
              {sourceMode === "ai" && (
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-400 ring-1 ring-slate-100">点击修订后可在弹窗修改</span>
              )}
              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-primary ring-1 ring-slate-100">{editedScore}分</span>
            </div>
          </div>
          <textarea
            ref={summaryRef}
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            readOnly={!editable}
            rows={5}
            className={`w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold leading-6 text-slate-700 outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10 ${
              editable ? "bg-white" : "bg-slate-100/70"
            }`}
          />
        </div>
      )}

      <div className="mt-4 space-y-4">
        <VersionFourPersonalItemEditor
          title="核心 KPI"
          items={kpiItems}
          onChange={updateItem}
          editable={editable}
        />
        <VersionFourPersonalItemEditor
          title="关键工作"
          items={keyWorkItems}
          onChange={updateItem}
          editable={editable}
        />
      </div>
      {isMidyear && (
        <div className="mt-4 space-y-4">
          <section className="rounded-xl border border-slate-100 bg-white p-3">
            <p className="text-xs font-black text-slate-800">主要贡献及亮点</p>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {MIDYEAR_CONTRIBUTION_FIELDS.map((field) => (
                <label key={field.key} className="block rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <span className="text-[11px] font-black text-slate-600">{field.label}</span>
                  <textarea
                    value={midyearDetails.contributions[field.key]}
                    onChange={(event) => updateContribution(field.key, event.target.value)}
                    readOnly={!editable}
                    rows={3}
                    className={`mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold leading-5 text-slate-600 outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10 ${
                      editable ? "bg-white" : "bg-slate-100/70"
                    }`}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-100 bg-white p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-black text-slate-800">不足及遗憾</p>
              {editable && (
                <button type="button" onClick={addRegret} className="inline-flex h-8 items-center gap-1 rounded-lg border border-primary/20 bg-white px-2.5 text-[11px] font-black text-primary transition hover:bg-primary-soft">
                  <Plus className="h-3.5 w-3.5" /> 新增
                </button>
              )}
            </div>
            <div className="mt-3 grid gap-3">
              {midyearDetails.regrets.map((regret, index) => (
                <label key={index} className="block rounded-xl border border-slate-100 bg-slate-50 p-3">
                  <span className="text-[11px] font-black text-slate-600">第{index + 1}点</span>
                  <textarea
                    value={regret}
                    onChange={(event) => updateRegret(index, event.target.value)}
                    readOnly={!editable}
                    rows={2}
                    className={`mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold leading-5 text-slate-600 outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10 ${
                      editable ? "bg-white" : "bg-slate-100/70"
                    }`}
                  />
                </label>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-slate-100 bg-white p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs font-black text-slate-800">附件</p>
              <input
                ref={attachmentInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => uploadAttachments(event.target.files)}
              />
              <button
                type="button"
                onClick={() => attachmentInputRef.current?.click()}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-primary px-3 text-[11px] font-black text-white transition hover:bg-primary/90"
              >
                <Plus className="h-3.5 w-3.5" />
                上传支撑材料
              </button>
            </div>
            <textarea
              value={midyearDetails.attachmentAdvice}
              onChange={(event) => setMidyearDetails((prev) => ({ ...prev, attachmentAdvice: event.target.value }))}
              readOnly={!editable}
              rows={3}
              className={`mt-3 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold leading-5 text-slate-600 outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10 ${
                editable ? "bg-slate-50" : "bg-slate-100/70"
              }`}
            />
            <div className="mt-3 space-y-2">
              {midyearDetails.attachments.length > 0 ? midyearDetails.attachments.map((file) => (
                <div key={file.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white text-primary ring-1 ring-slate-100">
                    <FileText className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-black text-slate-800">{file.name}</span>
                    <span className="mt-0.5 block text-[10px] font-semibold text-slate-400">{formatAttachmentSize(file.size)} · {file.type}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeAttachment(file.id)}
                    className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-white hover:text-primary"
                    aria-label={`删除附件${file.name}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              )) : (
                <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs font-semibold text-slate-400">
                  暂未上传附件，可上传数据看板、项目材料、客户反馈、会议纪要或成果截图。
                </div>
              )}
            </div>
          </section>
        </div>
      )}
      {sourceMode === "ai" && (
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {onSaveDraft && (
          <button
            type="button"
            onClick={() => onSaveDraft(editedReport())}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition hover:border-primary/30 hover:bg-primary-soft hover:text-primary"
          >
            <FileText className="h-3.5 w-3.5" />
            保存草稿
          </button>
        )}
        <button
          type="button"
          onClick={() => onSubmit(editedReport())}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-primary/25 bg-white px-3 text-xs font-black text-primary transition hover:bg-primary-soft"
        >
          <Check className="h-3.5 w-3.5" />
          录入系统
        </button>
        <button
          type="button"
          onClick={() => onSubmitEmail(editedReport())}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-black text-white transition hover:bg-primary/90"
        >
          <Mail className="h-3.5 w-3.5" />
          录入系统并发送邮件
        </button>
      </div>
      )}
    </article>
    {revisionDialogOpen && (
      <VersionFourPersonalRevisionDialog
        report={editedReport()}
        cycle={cycle}
        onClose={() => setRevisionDialogOpen(false)}
        onSave={(report) => {
          setSummary(report.summary);
          setItems(report.items.map((item) => ({ ...item })));
          if (report.midyear) setMidyearDetails(cloneMidyearReportDetails(report.midyear));
          setRevisionDialogOpen(false);
        }}
      />
    )}
    </>
  );
}

function VersionFourPersonalItemEditor({
  title,
  items,
  onChange,
  editable = true,
}: {
  title: string;
  items: PersonalReport["items"];
  onChange: (id: string, patch: Partial<PersonalReport["items"][number]>) => void;
  editable?: boolean;
}) {
  const hintField: MonthlyGuideHintField = title === "核心 KPI" ? "summaryKpi" : "summaryKeyWork";
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3">
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-black text-slate-800">{title}</p>
        <MonthlyGuideHint field={hintField} />
      </div>
      <div className="mt-3 overflow-hidden rounded-xl border border-slate-100">
        <table className="w-full table-fixed text-left">
          <colgroup>
            <col className="w-14" />
            <col className="w-[24%]" />
            <col className="w-[22%]" />
            <col className="w-24" />
            <col />
          </colgroup>
          <thead className="bg-slate-50 text-[11px] font-black text-slate-500">
            <tr>
              <th className="px-3 py-2 text-center">序号</th>
              <th className="px-3 py-2">{title}</th>
              <th className="px-3 py-2">目标/权重</th>
              <th className="px-3 py-2 text-center">自评分</th>
              <th className="px-3 py-2">填报内容</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item, index) => (
              <tr key={item.id} className="align-top text-xs font-semibold text-slate-700">
                <td className="px-3 py-3 text-center text-slate-500">{index + 1}</td>
                <td className="px-3 py-3">
                  <p className="font-black leading-5 text-slate-800">{item.title}</p>
                </td>
                <td className="px-3 py-3 text-[11px] leading-5 text-slate-500">
                  {item.weight ? <p className="font-bold">权重 {item.weight}</p> : null}
                  <p className="line-clamp-2">{item.goal}</p>
                </td>
                <td className="px-3 py-3">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={item.score}
                    onChange={(event) => onChange(item.id, { score: normalizeScore(event.target.value) ?? item.score })}
                    disabled={!editable}
                    className="h-9 w-full rounded-lg border border-slate-200 bg-white px-2 text-center text-xs font-black text-primary outline-none focus:border-primary/40 disabled:bg-slate-100 disabled:text-slate-400"
                    aria-label={`${item.title}自评分`}
                  />
                </td>
                <td className="px-3 py-3">
                  <textarea
                    value={item.note}
                    onChange={(event) => onChange(item.id, { note: event.target.value })}
                    readOnly={!editable}
                    rows={2}
                    className={`w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold leading-5 text-slate-600 outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10 ${
                      editable ? "bg-white" : "bg-slate-100/70"
                    }`}
                    aria-label={`${item.title}填报内容`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function VersionFourPersonalRevisionDialog({
  report,
  cycle = "monthly",
  onClose,
  onSave,
}: {
  report: PersonalReport;
  cycle?: ReportGuideCycle;
  onClose: () => void;
  onSave: (report: PersonalReport) => void;
}) {
  const [summary, setSummary] = useState(report.summary);
  const [items, setItems] = useState<PersonalReport["items"]>(() => report.items.map((item) => ({ ...item })));
  const [midyearDetails, setMidyearDetails] = useState<MidyearReportDetails>(() => cloneMidyearReportDetails(report.midyear));
  const isMidyear = cycle === "midyear";
  const updateItem = (id: string, patch: Partial<PersonalReport["items"][number]>) => {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, ...patch } : item));
  };
  const weightSum = PERSONAL_ITEMS.reduce((sum, item) => sum + (item.w ?? 0), 0);
  const editedScore = weightSum
    ? Math.round(items.reduce((sum, item) => {
      const source = PERSONAL_ITEMS.find((personalItem) => personalItem.id === item.id);
      return item.tag === "核心KPI" ? sum + item.score * (source?.w ?? 0) : sum;
    }, 0) / weightSum)
    : report.score;
  const kpiItems = items.filter((item) => item.tag === "核心KPI");
  const keyWorkItems = items.filter((item) => item.tag === "关键工作");

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-slate-950/25 px-4 pt-12">
      <section className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-[0_28px_90px_rgba(15,23,42,0.22)]">
        <div className="flex items-start justify-between gap-4 border-b border-border bg-primary-soft/45 px-6 py-5">
          <div className="min-w-0">
            <p className="text-lg font-black tracking-tight text-foreground">修订个人{isMidyear ? "年中汇报" : "月度汇报"}</p>
            <p className="mt-1 text-sm text-muted-foreground">在弹窗内修改 AI 草稿，保存后同步回对话中的汇报卡片。</p>
          </div>
          <span className="shrink-0 rounded-full bg-white px-3 py-1 text-sm font-black text-primary shadow-sm ring-1 ring-primary/10">
            {editedScore} 分
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white p-5">
          {!isMidyear && (
            <label className="block rounded-2xl border border-primary/15 bg-primary-soft/15 p-4">
              <span className="text-sm font-black text-foreground">综合汇报</span>
              <textarea
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                rows={6}
                className="mt-3 w-full resize-y rounded-xl border border-border bg-white px-4 py-3 text-sm font-semibold leading-7 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
              />
            </label>
          )}

          <div className="mt-4 space-y-4">
            <VersionFourPersonalItemEditor
              title="核心 KPI"
              items={kpiItems}
              onChange={updateItem}
            />
            <VersionFourPersonalItemEditor
              title="关键工作"
              items={keyWorkItems}
              onChange={updateItem}
            />
          </div>
          {isMidyear && (
            <div className="mt-4 space-y-4">
              <label className="block rounded-2xl border border-slate-100 bg-white p-4">
                <span className="text-sm font-black text-foreground">主要贡献及亮点</span>
                <textarea
                  value={MIDYEAR_CONTRIBUTION_FIELDS.map((field) => `${field.label}：${midyearDetails.contributions[field.key]}`).join("\n")}
                  onChange={(event) => {
                    const lines = event.target.value.split("\n");
                    setMidyearDetails((prev) => ({
                      ...prev,
                      contributions: Object.fromEntries(MIDYEAR_CONTRIBUTION_FIELDS.map((field, index) => [field.key, lines[index]?.replace(new RegExp(`^${field.label}：?`), "") || prev.contributions[field.key]])) as Record<MidyearContributionKey, string>,
                    }));
                  }}
                  rows={8}
                  className="mt-3 w-full resize-y rounded-xl border border-border bg-white px-4 py-3 text-sm font-semibold leading-7 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                />
              </label>
              <label className="block rounded-2xl border border-slate-100 bg-white p-4">
                <span className="text-sm font-black text-foreground">不足及遗憾 / 附件建议</span>
                <textarea
                  value={`${midyearDetails.regrets.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n\n附件建议：${midyearDetails.attachmentAdvice}`}
                  onChange={(event) => {
                    const [regretBlock, attachmentBlock = ""] = event.target.value.split(/\n\n附件建议：/);
                    setMidyearDetails((prev) => ({
                      ...prev,
                      regrets: regretBlock.split("\n").map((line) => line.replace(/^\d+\.\s*/, "").trim()).filter(Boolean),
                      attachmentAdvice: attachmentBlock || prev.attachmentAdvice,
                    }));
                  }}
                  rows={7}
                  className="mt-3 w-full resize-y rounded-xl border border-border bg-white px-4 py-3 text-sm font-semibold leading-7 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                />
              </label>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border bg-secondary/20 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-secondary"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => onSave({ ...report, summary, score: editedScore, items, midyear: isMidyear ? midyearDetails : report.midyear })}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            <Check className="h-4 w-4" />
            保存修改
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function VersionFourMidyearFeedbackSummaryCard({
  sub,
  draft,
  scoreMap,
  onSubmit,
  onSubmitEmail,
  onBackToList,
  onNext,
}: {
  sub: Subordinate;
  draft: FeedbackDraft;
  scoreMap: Record<string, number>;
  onSubmit: (draft: FeedbackDraft, scoreMap: Record<string, number>) => void;
  onSubmitEmail: (draft: FeedbackDraft, scoreMap: Record<string, number>) => void;
  onBackToList: () => void;
  onNext: () => void;
}) {
  const [localDraft, setLocalDraft] = useState(draft);
  const [localScoreMap, setLocalScoreMap] = useState(scoreMap);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const details = getMidyearFeedbackDetails(localDraft, localScoreMap, sub.name);

  return (
    <>
      <article className="max-w-4xl overflow-hidden rounded-2xl border border-primary/15 bg-white shadow-[0_16px_40px_rgba(47,102,217,0.08)]">
        <div className="bg-primary-soft/55 px-4 py-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black text-slate-950">{sub.name}｜年中反馈建议</p>
              <p className="mt-1 text-xs font-semibold text-slate-500">包含评分建议、综合评价、能力评估和发展趋势判断。</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <VersionFourMidyearBadge label="综合评分" value={`${details.overall.score}`} />
              <VersionFourMidyearBadge label="综合能力" value={details.capability} />
              <VersionFourMidyearBadge label="发展趋势" value={details.trend} />
              <VersionFourMidyearBadge label="推荐等级" value={details.model.rating} />
            </div>
          </div>
        </div>
        <div className="grid gap-3 p-4 md:grid-cols-3">
          <VersionFourBatchFeedbackSection label="工作亮点" text={details.overall.highlights} tone="success" />
          <VersionFourBatchFeedbackSection label="存在不足" text={details.overall.shortcomings} tone="warning" />
          <VersionFourBatchFeedbackSection label="明年重点工作" text={details.overall.nextYearFocus} tone="primary" />
        </div>
        <div className="grid gap-2 border-t border-slate-100 bg-white p-4 sm:grid-cols-3 lg:grid-cols-6">
          <button type="button" onClick={() => setRevisionOpen(true)} className="rounded-xl border border-primary/25 bg-white px-3 py-2.5 text-xs font-black text-primary transition hover:bg-primary-soft">查看完整反馈</button>
          <button type="button" onClick={() => onSubmit(localDraft, localScoreMap)} className="rounded-xl bg-primary px-3 py-2.5 text-xs font-black text-white transition hover:bg-primary/90">录入系统</button>
          <button type="button" onClick={() => onSubmitEmail(localDraft, localScoreMap)} className="rounded-xl border border-primary/25 bg-white px-3 py-2.5 text-xs font-black text-primary transition hover:bg-primary-soft">录入系统并发送邮件</button>
          <button type="button" onClick={() => setRevisionOpen(true)} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-black text-slate-600 transition hover:border-primary/30 hover:bg-primary-soft hover:text-primary">手动修订</button>
          <button type="button" onClick={onNext} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-black text-slate-600 transition hover:border-primary/30 hover:bg-primary-soft hover:text-primary">切换下一个</button>
          <button type="button" onClick={onBackToList} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-black text-slate-600 transition hover:border-primary/30 hover:bg-primary-soft hover:text-primary">返回列表</button>
        </div>
      </article>
      {revisionOpen && (
        <VersionFourMidyearFeedbackRevisionDialog
          subName={sub.name}
          draft={localDraft}
          scoreMap={localScoreMap}
          onClose={() => setRevisionOpen(false)}
          onSave={(nextDraft, nextScoreMap) => {
            setLocalDraft(nextDraft);
            setLocalScoreMap(nextScoreMap);
            setRevisionOpen(false);
          }}
        />
      )}
    </>
  );
}

function VersionFourMidyearBadge({ label, value }: { label: string; value: string }) {
  return (
    <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black text-primary shadow-sm ring-1 ring-primary/10">
      {label} {value}
    </span>
  );
}

function VersionFourMidyearFeedbackRevisionDialog({
  subName,
  draft,
  scoreMap,
  onClose,
  onSave,
}: {
  subName: string;
  draft: FeedbackDraft;
  scoreMap: Record<string, number>;
  onClose: () => void;
  onSave: (draft: FeedbackDraft, scoreMap: Record<string, number>) => void;
}) {
  const [activeSection, setActiveSection] = useState("score");
  const [localScoreMap, setLocalScoreMap] = useState<Record<string, number>>({ ...scoreMap });
  const [details, setDetails] = useState<MidyearSupervisorFeedback>(() => getMidyearFeedbackDetails(draft, scoreMap, subName));
  const [syncPromptVisible, setSyncPromptVisible] = useState(false);
  const navItems = [
    ["score", "核心KPI及关键工作评分"],
    ["overall", "综合评价"],
    ["model", "8Q+TEL"],
    ["capability", "综合能力和发展趋势"],
  ] as const;
  const syncScoreEffects = () => {
    const score = computeDirectFeedbackScore(localScoreMap);
    const rating = getMidyearRatingByScore(score);
    setDetails((current) => ({
      ...current,
      overall: { ...current.overall, score },
      model: {
        ...current.model,
        rating,
        dimensions: current.model.dimensions.map((dimension, index) => {
          const value = Math.max(70, Math.min(98, score + (index % 3 === 0 ? 3 : -1)));
          return { ...dimension, value, score: getMidyearRatingByScore(value) };
        }),
      },
      capability: getMidyearCapabilityByScore(score),
      trend: getMidyearTrendByScore(score),
    }));
    setSyncPromptVisible(false);
  };
  const updateScore = (id: string, value: string) => {
    const next = normalizeScore(value);
    if (next == null) return;
    setLocalScoreMap((prev) => ({ ...prev, [id]: next }));
    setDetails((current) => ({
      ...current,
      kpiScores: current.kpiScores.map((item) => item.id === id ? { ...item, supervisorScore: next } : item),
      keyWorkScores: current.keyWorkScores.map((item) => item.id === id ? { ...item, supervisorScore: next } : item),
    }));
    setSyncPromptVisible(true);
  };
  const save = () => {
    const nextDraft: FeedbackDraft = {
      ...draft,
      score: details.overall.score,
      highlights: details.overall.highlights,
      shortcomings: details.overall.shortcomings,
      nextFocus: details.overall.nextYearFocus,
      midyearFeedback: details,
      feedbackText: `整体评价：${subName}上半年综合评分建议为 ${details.overall.score} 分，推荐等级 ${details.model.rating}。\n\n主要贡献及亮点：${details.contributionReview}\n\n不足及遗憾：${details.regretReview}\n\n工作亮点：${details.overall.highlights}\n\n存在不足：${details.overall.shortcomings}\n\n明年重点工作：${details.overall.nextYearFocus}\n\n综合能力：${details.capability}；发展趋势：${details.trend}。`,
    };
    onSave(nextDraft, localScoreMap);
  };
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-slate-950/30 px-4 pt-8">
      <section className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-[0_28px_90px_rgba(15,23,42,0.24)]">
        <div className="flex items-start justify-between gap-4 border-b border-border bg-primary-soft/45 px-6 py-5">
          <div>
            <p className="text-lg font-black text-foreground">{subName}｜年中反馈修订</p>
          </div>
          <button type="button" onClick={onClose} className="grid h-8 w-8 place-items-center rounded-lg text-slate-500 transition hover:bg-white hover:text-primary" aria-label="关闭年中反馈修订">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-[220px_minmax(0,1fr)]">
          <aside className="border-r border-border bg-slate-50 p-3">
            <div className="space-y-1">
              {navItems.map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveSection(key)}
                  className={`w-full rounded-xl px-3 py-2.5 text-left text-xs font-black transition ${
                    activeSection === key ? "bg-primary text-white shadow-sm" : "bg-white text-slate-600 hover:bg-primary-soft hover:text-primary"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="mt-4 rounded-2xl bg-white p-3 ring-1 ring-slate-100">
              <p className="text-[11px] font-black text-slate-400">当前建议</p>
              <p className="mt-2 text-2xl font-black text-primary">{details.overall.score}</p>
              <p className="mt-1 text-xs font-bold text-slate-600">{details.capability} · {details.trend}</p>
            </div>
          </aside>
          <div className="min-h-0 overflow-y-auto p-5">
            {syncPromptVisible && (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-warning/20 bg-warning-soft px-4 py-3">
                <p className="text-xs font-black text-warning">主管评分已变化，是否同步更新综合评价、能力等级和发展趋势？</p>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setSyncPromptVisible(false)} className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-black text-slate-600">仅调整评分</button>
                  <button type="button" onClick={syncScoreEffects} className="rounded-lg bg-primary px-3 py-1.5 text-[11px] font-black text-white">同步更新评价</button>
                </div>
              </div>
            )}
            {activeSection === "score" && (
              <div className="space-y-4">
                <VersionFourMidyearScoreEditor title="核心KPI评分" rows={details.kpiScores} onScoreChange={updateScore} />
                <VersionFourMidyearScoreEditor title="关键工作评分" rows={details.keyWorkScores} onScoreChange={updateScore} />
              </div>
            )}
            {activeSection === "overall" && (
              <div className="space-y-4">
                <label className="block rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <span className="text-xs font-black text-slate-600">综合评分</span>
                  <input value={details.overall.score} onChange={(event) => setDetails((current) => ({ ...current, overall: { ...current.overall, score: normalizeScore(event.target.value) ?? current.overall.score } }))} className="mt-2 h-10 w-28 rounded-xl border border-slate-200 bg-white text-center text-sm font-black text-primary outline-none focus:ring-2 focus:ring-primary/20" />
                </label>
                <VersionFourMidyearTextSection title="主要贡献及亮点评价" value={details.contributionReview} onChange={(value) => setDetails((current) => ({ ...current, contributionReview: value }))} />
                <VersionFourMidyearTextSection title="不足及遗憾评价" value={details.regretReview} onChange={(value) => setDetails((current) => ({ ...current, regretReview: value }))} />
                <VersionFourMidyearTextSection title="亮点肯定" value={details.overall.highlights} onChange={(value) => setDetails((current) => ({ ...current, overall: { ...current.overall, highlights: value } }))} />
                <VersionFourMidyearTextSection title="不足提醒" value={details.overall.shortcomings} onChange={(value) => setDetails((current) => ({ ...current, overall: { ...current.overall, shortcomings: value } }))} />
                <VersionFourMidyearTextSection title="后续改进建议" value={details.overall.nextYearFocus} onChange={(value) => setDetails((current) => ({ ...current, overall: { ...current.overall, nextYearFocus: value } }))} />
              </div>
            )}
            {activeSection === "model" && (
              <div className="space-y-4">
                <section className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs font-black text-slate-700">定量评价</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {MIDYEAR_RATINGS.map((rating) => (
                      <button key={rating} type="button" onClick={() => setDetails((current) => ({ ...current, model: { ...current.model, rating } }))} className={`rounded-xl px-4 py-2 text-xs font-black ${details.model.rating === rating ? "bg-primary text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
                        {rating}
                      </button>
                    ))}
                  </div>
                </section>
                <section className="rounded-2xl border border-slate-100 bg-white p-4">
                  <p className="text-xs font-black text-slate-700">能力维度评分条</p>
                  <div className="mt-3 space-y-3">
                    {details.model.dimensions.map((dimension) => (
                      <div key={dimension.id} className="grid items-center gap-3 md:grid-cols-[150px_minmax(0,1fr)_56px]">
                        <div>
                          <p className="text-xs font-black text-slate-800">{dimension.label}</p>
                          <p className="text-[10px] font-semibold text-slate-400">{dimension.description}</p>
                        </div>
                        <input type="range" min={60} max={100} value={dimension.value} onChange={(event) => {
                          const value = Number(event.target.value);
                          setDetails((current) => ({ ...current, model: { ...current.model, dimensions: current.model.dimensions.map((item) => item.id === dimension.id ? { ...item, value, score: getMidyearRatingByScore(value) } : item) } }));
                        }} className="w-full accent-primary" title={dimension.evidence} />
                        <span className="text-xs font-black text-primary">{dimension.score}</span>
                      </div>
                    ))}
                  </div>
                </section>
                <section className="rounded-2xl border border-slate-100 bg-white p-4">
                  <p className="text-xs font-black text-slate-700">优势标签</p>
                  <div className="mt-3 grid gap-3 lg:grid-cols-2">
                    {details.model.dimensions.map((dimension) => (
                      <div key={dimension.id} className="rounded-xl bg-slate-50 px-3 py-2.5">
                        <p className="text-[11px] font-black text-slate-500">{dimension.label}</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {getMidyearAbilityDimensionTags(dimension).map((tag) => {
                            const checked = details.model.tags.includes(tag);
                            return (
                              <button
                                key={`${dimension.id}-${tag}`}
                                type="button"
                                onClick={() => setDetails((current) => ({
                                  ...current,
                                  model: {
                                    ...current.model,
                                    tags: checked
                                      ? current.model.tags.filter((item) => item !== tag)
                                      : [...current.model.tags, tag],
                                  },
                                }))}
                                className={`rounded-lg border px-3 py-1.5 text-[11px] font-black ${
                                  checked ? "border-primary bg-primary-soft text-primary" : "border-slate-200 bg-white text-slate-500"
                                }`}
                              >
                                {checked ? "✓ " : ""}{tag}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            )}
            {activeSection === "capability" && (
              <div className="space-y-4">
                <section className="rounded-2xl border border-slate-100 bg-white p-4">
                  <p className="text-xs font-black text-slate-700">综合能力</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {MIDYEAR_CAPABILITIES.map((capability) => (
                      <button key={capability} type="button" onClick={() => setDetails((current) => ({ ...current, capability }))} className={`rounded-xl px-4 py-2 text-xs font-black ${details.capability === capability ? "bg-primary text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>{capability}</button>
                    ))}
                  </div>
                </section>
                <section className="rounded-2xl border border-slate-100 bg-white p-4">
                  <p className="text-xs font-black text-slate-700">发展趋势</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {MIDYEAR_TRENDS.map((trend) => (
                      <button key={trend} type="button" onClick={() => setDetails((current) => ({ ...current, trend }))} className={`rounded-xl px-4 py-2 text-xs font-black ${details.trend === trend ? "bg-primary text-white" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>{trend}</button>
                    ))}
                  </div>
                </section>
                <section className="rounded-2xl border border-primary/15 bg-primary-soft/25 p-4">
                  <p className="text-xs font-black text-primary">AI建议依据</p>
                  <p className="mt-2 text-xs font-semibold leading-6 text-slate-600">{details.evidence.at(-1)}</p>
                </section>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 border-t border-border bg-secondary/20 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-secondary">取消</button>
          <button type="button" onClick={save} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90">
            <Check className="h-4 w-4" />
            保存修改
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function VersionFourMidyearScoreEditor({
  title,
  rows,
  onScoreChange,
}: {
  title: string;
  rows: MidyearFeedbackScoreRow[];
  onScoreChange: (id: string, value: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-slate-900">{title}</p>
        <span className="rounded-full bg-primary-soft px-3 py-1 text-[11px] font-black text-primary">支持应用AI建议/手动修改</span>
      </div>
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-100">
        <table className="w-full table-fixed text-left">
          <thead className="bg-slate-50 text-[11px] font-black text-slate-500">
            <tr>
              <th className="w-12 px-3 py-2 text-center">序号</th>
              <th className="w-[18%] px-3 py-2">{title.replace("评分", "")}</th>
              <th className="px-3 py-2">目标/时间</th>
              <th className="px-3 py-2">年度/年中汇报</th>
              <th className="w-24 px-3 py-2 text-center">月均自评</th>
              <th className="w-24 px-3 py-2 text-center">主管评分</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, index) => (
              <tr key={row.id} className="align-top text-xs font-semibold text-slate-700">
                <td className="px-3 py-3 text-center text-slate-500">{index + 1}</td>
                <td className="px-3 py-3">
                  <p className="font-black text-slate-900">{row.title}</p>
                  {row.weight && <p className="mt-1 text-[10px] text-slate-400">权重 {row.weight}</p>}
                </td>
                <td className="px-3 py-3 text-[11px] leading-5 text-slate-500">{row.goal}{row.time ? `；${row.time}` : ""}</td>
                <td className="px-3 py-3 text-[11px] leading-5 text-slate-500">
                  <p>{row.annualReport}</p>
                  <p className="mt-1 text-slate-600">{row.midyearReport}</p>
                </td>
                <td className="px-3 py-3 text-center text-slate-500">{row.monthlyAvg}</td>
                <td className="px-3 py-3">
                  <input value={row.supervisorScore} onChange={(event) => onScoreChange(row.id, event.target.value)} className="h-9 w-full rounded-lg border border-slate-200 bg-white text-center text-xs font-black text-primary outline-none focus:ring-2 focus:ring-primary/20" />
                  <button type="button" onClick={() => onScoreChange(row.id, String(row.aiScore))} className="mt-1 w-full rounded-md bg-primary-soft py-1 text-[10px] font-black text-primary">应用AI建议</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function VersionFourMidyearTextSection({
  title,
  value,
  onChange,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-100 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black text-slate-900">{title}</p>
      </div>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} rows={8} className="mt-3 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold leading-7 text-slate-700 outline-none focus:ring-2 focus:ring-primary/20" />
    </section>
  );
}

function VersionFourFeedbackDraftCard({
  sub,
  draft,
  scoreMap,
  sourceMode,
  cycle = "monthly",
  onSwitchMode,
  onRegenerate,
  onSaveDraft,
  onSubmit,
  onSubmitEmail,
}: {
  sub: Subordinate;
  draft: FeedbackDraft;
  scoreMap: Record<string, number>;
  sourceMode: Exclude<VersionFourWriteMode, "choice">;
  cycle?: ReportGuideCycle;
  onSwitchMode: (mode: Exclude<VersionFourWriteMode, "choice">) => void;
  onRegenerate: () => void;
  onSaveDraft?: (draft: FeedbackDraft, scoreMap: Record<string, number>) => void;
  onSubmit: (draft: FeedbackDraft, scoreMap: Record<string, number>) => void;
  onSubmitEmail: (draft: FeedbackDraft, scoreMap: Record<string, number>) => void;
}) {
  const [overall, setOverall] = useState(draft.feedbackText);
  const [highlights, setHighlights] = useState(draft.highlights);
  const [shortcomings, setShortcomings] = useState(draft.shortcomings);
  const [nextFocus, setNextFocus] = useState(draft.nextFocus);
  const [approvalOpinion, setApprovalOpinion] = useState(draft.approvalOpinion ?? "同意录入系统。请结合事实依据和附件材料完成最终确认。");
  const [localScoreMap, setLocalScoreMap] = useState<Record<string, number>>({ ...scoreMap });
  const [revisionDialogOpen, setRevisionDialogOpen] = useState(false);
  const editedScore = computeDirectFeedbackScore(localScoreMap);
  const isMidyear = cycle === "midyear";
  const editable = sourceMode === "direct";
  const updateScore = (id: string, value: string) => {
    const next = normalizeScore(value);
    if (next == null) return;
    setLocalScoreMap((prev) => ({ ...prev, [id]: next }));
  };
  const editedDraft = (): FeedbackDraft => {
    const nextDraft = {
      ...draft,
      score: editedScore,
      highlights,
      shortcomings,
      nextFocus,
      approvalOpinion: isMidyear ? approvalOpinion : draft.approvalOpinion,
    };
    return {
      ...nextDraft,
      feedbackText: isMidyear ? overall : getFeedbackText(nextDraft),
    };
  };
  const feedbackSections: Array<[string, string, (next: string) => void, MonthlyGuideHintField]> = [
    [isMidyear ? "亮点肯定" : "亮点", highlights, setHighlights, "feedbackHighlights"],
    [isMidyear ? "不足提醒" : "不足", shortcomings, setShortcomings, "feedbackShortcomings"],
    [isMidyear ? "下阶段建议" : "下月重点", nextFocus, setNextFocus, "feedbackNextFocus"],
  ];
  if (isMidyear) {
    feedbackSections.push(["审批意见", approvalOpinion, setApprovalOpinion, "feedbackOverall"]);
  }

  return (
    <>
    <article className="rounded-2xl border border-primary/15 bg-white p-4 shadow-[0_16px_40px_rgba(47,102,217,0.08)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="grid h-8 w-8 place-items-center rounded-xl bg-primary-soft text-primary">
              <MessageCircle className="h-4 w-4" />
            </span>
            <p className="text-sm font-black text-slate-950">{sub.name} · {sourceMode === "direct" ? `直接填写${isMidyear ? "年中反馈" : "主考反馈"}` : `AI ${isMidyear ? "年中反馈" : "主考反馈"}`}</p>
            <span className="rounded-full bg-primary-soft px-2.5 py-1 text-[11px] font-black text-primary">{editedScore}分</span>
          </div>
          <p className="mt-2 text-xs font-semibold text-slate-500">{isMidyear ? "2026年中绩效 · 结合年中总结、KPI、关键工作、历史反馈与附件生成" : `${getCurrentMonthPeriod()} · 结合月报、KPI 与关键工作生成`}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {sourceMode === "ai" && (
            <button
              type="button"
              onClick={() => onSwitchMode("direct")}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-primary/20 bg-primary-soft/50 px-3 text-xs font-black text-primary transition hover:bg-primary-soft"
            >
              <Pencil className="h-3.5 w-3.5" />
              切换自主填写
            </button>
          )}
          {sourceMode === "ai" && (
            <button
              type="button"
              onClick={() => setRevisionDialogOpen(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition hover:border-primary/30 hover:bg-primary-soft hover:text-primary"
            >
              <Pencil className="h-3.5 w-3.5" />
              修订
            </button>
          )}
          {sourceMode === "direct" && (
            <>
              {onSaveDraft && (
                <button
                  type="button"
                  onClick={() => onSaveDraft(editedDraft(), localScoreMap)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition hover:border-primary/30 hover:bg-primary-soft hover:text-primary"
                >
                  <FileText className="h-3.5 w-3.5" />
                  保存草稿
                </button>
              )}
              <button
                type="button"
                onClick={() => onSubmit(editedDraft(), localScoreMap)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-primary/25 bg-white px-3 text-xs font-black text-primary transition hover:bg-primary-soft"
              >
                <Check className="h-3.5 w-3.5" />
                录入系统
              </button>
              <button
                type="button"
                onClick={() => onSubmitEmail(editedDraft(), localScoreMap)}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-black text-white transition hover:bg-primary/90"
              >
                <Mail className="h-3.5 w-3.5" />
                录入系统并发送邮件
              </button>
            </>
          )}
        </div>
      </div>

      {isMidyear && (
        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-black text-slate-800">综合评价</p>
              <MonthlyGuideHint field="feedbackOverall" />
            </div>
            <div className="flex items-center gap-2">
              {sourceMode === "ai" && (
                <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-slate-400 ring-1 ring-slate-100">点击修订后可在弹窗修改</span>
              )}
              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-black text-primary ring-1 ring-slate-100">主考 {editedScore}分</span>
            </div>
          </div>
          <textarea
            value={overall}
            onChange={(event) => setOverall(event.target.value)}
            readOnly={!editable}
            rows={5}
            className={`w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold leading-6 text-slate-700 outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10 ${
              editable ? "bg-white" : "bg-slate-100/70"
            }`}
          />
        </div>
      )}

      <div className={`mt-4 grid gap-3 ${isMidyear ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
        {feedbackSections.map(([label, value, setter, hintField]) => (
          <div key={label} className="rounded-xl border border-slate-100 bg-white px-3 py-3">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-black text-slate-800">{label}</p>
              <MonthlyGuideHint field={hintField} />
            </div>
            <textarea
              value={value}
              onChange={(event) => setter(event.target.value)}
              readOnly={!editable}
              rows={4}
              className={`mt-2 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-[11px] font-semibold leading-5 text-slate-600 outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10 ${
                editable ? "bg-slate-50" : "bg-slate-100/70"
              }`}
            />
          </div>
        ))}
      </div>

      <div className="mt-4 space-y-4">
        <VersionFourFeedbackScoreEditor
          title="核心 KPI"
          items={KPI_SCORE_ITEMS}
          scoreMap={localScoreMap}
          onScoreChange={updateScore}
          editable={editable}
        />
        <VersionFourFeedbackScoreEditor
          title="关键工作"
          items={KEY_WORK_SCORE_ITEMS}
          scoreMap={localScoreMap}
          onScoreChange={updateScore}
          editable={editable}
        />
      </div>

      {sourceMode === "ai" && (
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {onSaveDraft && (
          <button
            type="button"
            onClick={() => onSaveDraft(editedDraft(), localScoreMap)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-xs font-black text-slate-600 transition hover:border-primary/30 hover:bg-primary-soft hover:text-primary"
          >
            <FileText className="h-3.5 w-3.5" />
            保存草稿
          </button>
        )}
        <button
          type="button"
          onClick={() => onSubmit(editedDraft(), localScoreMap)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-primary/25 bg-white px-3 text-xs font-black text-primary transition hover:bg-primary-soft"
        >
          <Check className="h-3.5 w-3.5" />
          {isMidyear ? "确认反馈" : "录入系统"}
        </button>
        <button
          type="button"
          onClick={() => onSubmitEmail(editedDraft(), localScoreMap)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-black text-white transition hover:bg-primary/90"
        >
          <Mail className="h-3.5 w-3.5" />
          录入系统并发送邮件
        </button>
      </div>
      )}
    </article>
    {revisionDialogOpen && (
      <VersionFourFeedbackRevisionDialog
        subName={sub.name}
        draft={editedDraft()}
        scoreMap={localScoreMap}
        cycle={cycle}
        onClose={() => setRevisionDialogOpen(false)}
        onSave={(nextDraft, nextScoreMap) => {
          setOverall(nextDraft.feedbackText);
          setHighlights(nextDraft.highlights);
          setShortcomings(nextDraft.shortcomings);
          setNextFocus(nextDraft.nextFocus);
          setApprovalOpinion(nextDraft.approvalOpinion ?? approvalOpinion);
          setLocalScoreMap({ ...nextScoreMap });
          setRevisionDialogOpen(false);
        }}
      />
    )}
    </>
  );
}

function VersionFourFeedbackScoreEditor({
  title,
  items,
  scoreMap,
  onScoreChange,
  editable = true,
}: {
  title: string;
  items: Array<typeof SCORE_ITEMS[number]>;
  scoreMap: Record<string, number>;
  onScoreChange: (id: string, value: string) => void;
  editable?: boolean;
}) {
  return (
    <section className="rounded-xl border border-slate-100 bg-white p-3">
      <div className="flex items-center gap-1.5">
        <p className="text-xs font-black text-slate-800">{title}</p>
        <MonthlyGuideHint field="feedbackScore" />
      </div>
      <div className="mt-3 overflow-hidden rounded-xl border border-slate-100">
        <table className="w-full table-fixed text-left">
          <colgroup>
            <col className="w-14" />
            <col />
            <col className="w-24" />
            <col className="w-28" />
          </colgroup>
          <thead className="bg-slate-50 text-[11px] font-black text-slate-500">
            <tr>
              <th className="px-3 py-2 text-center">序号</th>
              <th className="px-3 py-2">{title}</th>
              <th className="px-3 py-2 text-center">自评分</th>
              <th className="px-3 py-2 text-center">主管评分</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map((item, index) => (
              <tr key={item.id} className="text-xs font-semibold text-slate-700">
                <td className="px-3 py-2 text-center text-slate-500">{index + 1}</td>
                <td className="px-3 py-2">
                  <p className="truncate font-black text-slate-800">{item.title}</p>
                  {"weight" in item && item.weight ? (
                    <p className="mt-0.5 text-[10px] font-bold text-slate-400">权重 {item.weight}</p>
                  ) : null}
                </td>
                <td className="px-3 py-2 text-center text-slate-500">{item.self}</td>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={scoreMap[item.id] ?? item.self}
                    onChange={(event) => onScoreChange(item.id, event.target.value)}
                    disabled={!editable}
                    className="h-8 w-full rounded-lg border border-slate-200 bg-white px-2 text-center text-xs font-black text-primary outline-none focus:border-primary/40 disabled:bg-slate-100 disabled:text-slate-400"
                    aria-label={`${item.title}主考评分`}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function VersionFourFeedbackRevisionDialog({
  subName,
  draft,
  scoreMap,
  cycle = "monthly",
  onClose,
  onSave,
}: {
  subName: string;
  draft: FeedbackDraft;
  scoreMap: Record<string, number>;
  cycle?: ReportGuideCycle;
  onClose: () => void;
  onSave: (draft: FeedbackDraft, scoreMap: Record<string, number>) => void;
}) {
  const [overall, setOverall] = useState(draft.feedbackText);
  const [highlights, setHighlights] = useState(draft.highlights);
  const [shortcomings, setShortcomings] = useState(draft.shortcomings);
  const [nextFocus, setNextFocus] = useState(draft.nextFocus);
  const [approvalOpinion, setApprovalOpinion] = useState(draft.approvalOpinion ?? "同意录入系统。请结合事实依据和附件材料完成最终确认。");
  const [localScoreMap, setLocalScoreMap] = useState<Record<string, number>>({ ...scoreMap });
  const editedScore = computeDirectFeedbackScore(localScoreMap);
  const isMidyear = cycle === "midyear";
  const updateScore = (id: string, value: string) => {
    const next = normalizeScore(value);
    if (next == null) return;
    setLocalScoreMap((prev) => ({ ...prev, [id]: next }));
  };
  const save = () => {
    onSave({
      ...draft,
      score: editedScore,
      feedbackText: overall,
      highlights,
      shortcomings,
      nextFocus,
      approvalOpinion: isMidyear ? approvalOpinion : draft.approvalOpinion,
    }, localScoreMap);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-slate-950/25 px-4 pt-12">
      <section className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-[0_28px_90px_rgba(15,23,42,0.22)]">
        <div className="flex items-start justify-between gap-4 border-b border-border bg-primary-soft/45 px-6 py-5">
          <div className="min-w-0">
            <p className="text-lg font-black tracking-tight text-foreground">修订{subName}{isMidyear ? "年中反馈" : "主考反馈"}</p>
            <p className="mt-1 text-sm text-muted-foreground">在弹窗内修改 AI 反馈正文和评分，保存后同步回对话中的反馈卡片。</p>
          </div>
          <span className="shrink-0 rounded-full bg-white px-3 py-1 text-sm font-black text-primary shadow-sm ring-1 ring-primary/10">
            {editedScore} 分
          </span>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white p-5">
          <label className="block rounded-2xl border border-primary/15 bg-primary-soft/15 p-4">
            <span className="text-sm font-black text-foreground">综合评价</span>
            <textarea
              value={overall}
              onChange={(event) => setOverall(event.target.value)}
              rows={6}
              className="mt-3 w-full resize-y rounded-xl border border-border bg-white px-4 py-3 text-sm font-semibold leading-7 text-foreground outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
            />
          </label>

          <div className={`mt-4 grid gap-3 ${isMidyear ? "md:grid-cols-2" : "md:grid-cols-3"}`}>
            <label className="block rounded-2xl border border-slate-100 bg-white p-4">
              <span className="text-xs font-black text-success">亮点</span>
              <textarea
                value={highlights}
                onChange={(event) => setHighlights(event.target.value)}
                rows={6}
                className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold leading-6 text-slate-700 outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
              />
            </label>
            <label className="block rounded-2xl border border-slate-100 bg-white p-4">
              <span className="text-xs font-black text-warning">不足</span>
              <textarea
                value={shortcomings}
                onChange={(event) => setShortcomings(event.target.value)}
                rows={6}
                className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold leading-6 text-slate-700 outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
              />
            </label>
            <label className="block rounded-2xl border border-slate-100 bg-white p-4">
              <span className="text-xs font-black text-primary">{isMidyear ? "下阶段建议" : "下月重点"}</span>
              <textarea
                value={nextFocus}
                onChange={(event) => setNextFocus(event.target.value)}
                rows={6}
                className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold leading-6 text-slate-700 outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
              />
            </label>
            {isMidyear && (
              <label className="block rounded-2xl border border-slate-100 bg-white p-4">
                <span className="text-xs font-black text-primary">审批意见</span>
                <textarea
                  value={approvalOpinion}
                  onChange={(event) => setApprovalOpinion(event.target.value)}
                  rows={6}
                  className="mt-2 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold leading-6 text-slate-700 outline-none transition focus:border-primary/40 focus:ring-2 focus:ring-primary/10"
                />
              </label>
            )}
          </div>

          <div className="mt-4 space-y-4">
            <VersionFourFeedbackScoreEditor
              title="核心 KPI"
              items={KPI_SCORE_ITEMS}
              scoreMap={localScoreMap}
              onScoreChange={updateScore}
            />
            <VersionFourFeedbackScoreEditor
              title="关键工作"
              items={KEY_WORK_SCORE_ITEMS}
              scoreMap={localScoreMap}
              onScoreChange={updateScore}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border bg-secondary/20 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-secondary"
          >
            取消
          </button>
          <button
            type="button"
            onClick={save}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            <Check className="h-4 w-4" />
            保存修改
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function VersionFourContextPanel({
  activeMode,
  sub,
  personalDraft,
  submittedPersonalReport,
  submittedFeedback,
  onOpenDrawer,
}: {
  activeMode: "report" | "feedback";
  sub: Subordinate | null;
  personalDraft: PersonalReport;
  submittedPersonalReport?: SubmittedPersonalMonthlyReport;
  submittedFeedback?: SubmittedFeedback;
  onOpenDrawer: () => void;
}) {
  const contextTitle = activeMode === "report" ? "我的绩效上下文" : `${sub?.name ?? "下属"}绩效上下文`;
  const reportText = activeMode === "report"
    ? submittedPersonalReport?.report.original ?? personalDraft.summary
    : getSubMonthlyReportForPeriod(getCurrentMonthPeriod())?.highlights ?? "暂无本期月度汇报";

  return (
    <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_44px_rgba(31,47,71,0.06)]">
      <div className="border-b border-slate-100 px-4 py-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-slate-950">{contextTitle}</p>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-500">AI 生成时实时引用</p>
          </div>
          <button
            type="button"
            onClick={onOpenDrawer}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:border-primary/30 hover:bg-primary-soft hover:text-primary"
            aria-label="打开绩效卡片"
            title="打开绩效卡片"
          >
            <PanelRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        <section className="rounded-xl border border-slate-100 bg-slate-50 p-3">
          <p className="text-xs font-black text-slate-800">对象信息</p>
          <div className="mt-3 flex items-center gap-3">
            <img
              src={activeMode === "report" ? MANAGER_AVATAR_URL : sub ? getPersonAvatarUrl(sub.id, sub.name) : MANAGER_AVATAR_URL}
              alt={activeMode === "report" ? CURRENT_USER.name : sub?.name ?? ""}
              className="h-12 w-12 rounded-xl object-cover ring-1 ring-white"
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-slate-900">{activeMode === "report" ? CURRENT_USER.name : sub?.name ?? "--"}</p>
              <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-500">{activeMode === "report" ? CURRENT_USER.title : sub?.title ?? "--"}</p>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-slate-100 bg-white p-3">
          <p className="text-xs font-black text-slate-800">月度汇报</p>
          <p className="mt-2 line-clamp-[8] text-xs font-semibold leading-6 text-slate-600">{reportText}</p>
        </section>

        <section className="rounded-xl border border-slate-100 bg-white p-3">
          <p className="text-xs font-black text-slate-800">{activeMode === "report" ? "核心 KPI" : "上级反馈"}</p>
          {activeMode === "report" ? (
            <div className="mt-2 space-y-2">
              {personalDraft.items.filter((item) => item.tag === "核心KPI").map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-2.5 py-2">
                  <span className="truncate text-[11px] font-bold text-slate-600">{item.title}</span>
                  <span className="shrink-0 text-[11px] font-black text-primary">{item.score}分</span>
                </div>
              ))}
            </div>
          ) : submittedFeedback ? (
            <div className="mt-2 space-y-2 text-xs font-semibold leading-6 text-slate-600">
              <p>评分：{submittedFeedback.score}分</p>
              <p>{submittedFeedback.highlights}</p>
            </div>
          ) : (
            <div className="mt-3 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-6 text-center text-xs font-semibold text-slate-400">
              暂无上级反馈
            </div>
          )}
        </section>
      </div>
    </aside>
  );
}

function VersionFourDrawerActions({
  expanded,
  onToggleExpanded,
  onClose,
}: {
  expanded: boolean;
  onToggleExpanded: () => void;
  onClose: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onToggleExpanded}
        className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-white text-muted-foreground transition hover:border-primary/35 hover:bg-primary-soft hover:text-accent-foreground"
        aria-label={expanded ? "收缩绩效卡片" : "展开绩效卡片"}
        title={expanded ? "收缩" : "展开"}
      >
        {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
      </button>
      <button
        type="button"
        onClick={onClose}
        className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-white text-muted-foreground transition hover:border-primary/35 hover:bg-primary-soft hover:text-accent-foreground"
        aria-label="关闭绩效卡片"
        title="关闭"
      >
        <X className="h-4 w-4" />
      </button>
    </>
  );
}

function VersionThreeWritingWorkspace({
  activeTab,
  personalReportStatus,
  selectedSub,
  feedbackSubs,
  sidebarCollapsed,
  submittedFeedbackBySubId,
  submittedPersonalReports,
  personalReportWorkMode,
  feedbackWorkMode,
  onTabChange,
  onToggleSidebar,
  onSelectFeedbackSub,
  onPersonalModeChange,
  onFeedbackModeChange,
  getRemindCooldownMs,
  onRemindSub,
  onPersonalSubmitted,
  onFeedbackSubmitted,
  reportAiContent,
  feedbackAiContent,
}: {
  activeTab: VersionThreeWorkTab;
  personalReportStatus: PersonalMonthlyReportStatus;
  selectedSub: Subordinate | null;
  feedbackSubs: Subordinate[];
  sidebarCollapsed: boolean;
  submittedFeedbackBySubId: Record<string, SubmittedFeedback>;
  submittedPersonalReports: Record<string, SubmittedPersonalMonthlyReport>;
  personalReportWorkMode: PersonalReportWorkMode;
  feedbackWorkMode: FeedbackWorkMode;
  onTabChange: (tab: VersionThreeWorkTab) => void;
  onToggleSidebar: () => void;
  onSelectFeedbackSub: (sub: Subordinate) => void;
  onPersonalModeChange: (mode: PersonalReportWorkMode) => void;
  onFeedbackModeChange: (mode: FeedbackWorkMode) => void;
  getRemindCooldownMs: (id: string) => number;
  onRemindSub: (sub: Subordinate) => void;
  onPersonalSubmitted: (report: SubmittedPersonalMonthlyReport) => void;
  onFeedbackSubmitted: (subId: string, feedback: SubmittedFeedback) => void;
  reportAiContent: React.ReactNode;
  feedbackAiContent: React.ReactNode;
}) {
  const statusMeta: Record<PersonalMonthlyReportStatus, { label: string; cls: string }> = {
    pending_submit: { label: "本期待提交", cls: "bg-primary-soft text-primary" },
    waiting_feedback: { label: "等待主考反馈", cls: "bg-warning-soft text-warning" },
    feedback_done: { label: "主考已反馈", cls: "bg-success-soft text-success" },
  };
  const personalStatus = statusMeta[personalReportStatus];
  const visibleFeedbackSubs = filterAndSortOrgSubs(feedbackSubs, "all");

  return (
    <section className="h-[calc(100vh-3.5rem)] min-h-0 bg-slate-50 p-4">
      <div className="mb-3 flex min-h-12 items-center justify-between gap-4">
        <div className="flex h-12 items-center rounded-2xl border border-border bg-white p-1 shadow-[0_12px_28px_rgba(15,23,42,0.07)]">
          {([
            ["report", "写汇报"],
            ["feedback", "写反馈"],
          ] as const).map(([tab, label]) => {
            const active = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => onTabChange(tab)}
                className={`h-10 min-w-[132px] rounded-xl px-6 text-lg font-black transition ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-primary-soft hover:text-accent-foreground"
                }`}
                aria-pressed={active}
              >
                {label}
              </button>
            );
          })}
        </div>
        {activeTab === "report" && (
          <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-black ${personalStatus.cls}`}>
            {personalStatus.label}
          </span>
        )}
      </div>

      <div className="grid h-[calc(100%-3.75rem)] min-h-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(460px,1fr)]">
        <div className="min-h-0 overflow-hidden rounded-2xl border border-border bg-white shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
          {activeTab === "report" ? (
            <SubordinatePerformancePanel
              sub={MANAGER_DETAIL_SUB}
              onWriteFeedback={() => {}}
              onRemind={() => {}}
              remindCooldownMs={0}
              expanded
              isManager
              submittedPersonalReports={submittedPersonalReports}
              versionThreeLayout
              headerActions={
                <button
                  type="button"
                  className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-white text-muted-foreground transition hover:border-primary/35 hover:bg-primary-soft hover:text-accent-foreground"
                  aria-label="返回工作台"
                  title="返回工作台"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              }
            />
          ) : (
            <div className={`grid h-full min-h-0 transition-[grid-template-columns] duration-200 ${
              sidebarCollapsed ? "grid-cols-[56px_minmax(0,1fr)]" : "grid-cols-[300px_minmax(0,1fr)]"
            }`}>
              <VersionThreeFeedbackSubList
                subs={visibleFeedbackSubs}
                selectedId={selectedSub?.id}
                collapsed={sidebarCollapsed}
                onToggle={onToggleSidebar}
                onSelect={onSelectFeedbackSub}
              />
              {selectedSub ? (
                <SubordinatePerformancePanel
                  sub={selectedSub}
                  submittedFeedback={submittedFeedbackBySubId[selectedSub.id]}
                  onWriteFeedback={() => {}}
                  onRemind={() => onRemindSub(selectedSub)}
                  remindCooldownMs={getRemindCooldownMs(selectedSub.id)}
                  expanded
                  versionThreeLayout
                />
              ) : (
                <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
                  请选择下属后再写反馈。
                </div>
              )}
            </div>
          )}
        </div>

        <div className="min-h-0 overflow-hidden rounded-2xl border border-border bg-white shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
          {activeTab === "report" ? (
            <PersonalReportWritingPanel
              activeMode={personalReportWorkMode}
              onModeChange={onPersonalModeChange}
              onSubmitted={onPersonalSubmitted}
              aiContent={reportAiContent}
            />
          ) : (
            <FeedbackWritingPanel
              selectedSub={selectedSub}
              activeMode={feedbackWorkMode}
              onModeChange={onFeedbackModeChange}
              onSubmitted={onFeedbackSubmitted}
              aiContent={feedbackAiContent}
            />
          )}
        </div>
      </div>
    </section>
  );
}

function VersionThreeFeedbackSubList({
  subs,
  selectedId,
  collapsed,
  onToggle,
  onSelect,
}: {
  subs: Subordinate[];
  selectedId?: string;
  collapsed: boolean;
  onToggle: () => void;
  onSelect: (sub: Subordinate) => void;
}) {
  const [activeGroup, setActiveGroup] = useState<Subordinate["type"]>("direct");
  const [statusFilter, setStatusFilter] = useState<OrgStatusFilter>("all");
  const directSubs = subs.filter((sub) => sub.type === "direct");
  const indirectSubs = subs.filter((sub) => sub.type === "indirect");
  const activeSubs = activeGroup === "direct" ? directSubs : indirectSubs;
  const visibleSubs = filterAndSortOrgSubs(activeSubs, statusFilter);
  const pendingFeedbackCount = subs.filter((sub) => sub.status === "pending_feedback").length;
  const pendingSubmitCount = subs.filter((sub) => sub.status === "not_submitted" || sub.status === "reminded").length;
  const confirmedCount = subs.filter((sub) => sub.status === "confirmed").length;

  if (collapsed) {
    return (
      <aside className="flex h-full min-h-0 flex-col items-center border-r border-border bg-secondary/30 py-3">
        <button
          type="button"
          onClick={onToggle}
          className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-white text-muted-foreground shadow-sm transition hover:border-primary/35 hover:bg-primary-soft hover:text-primary"
          aria-label="展开下属列表"
          title="展开下属列表"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
        <div className="mt-4 grid gap-2">
          {visibleSubs.slice(0, 6).map((sub) => (
            <button
              key={sub.id}
              type="button"
              onClick={() => onSelect(sub)}
              className={`grid h-9 w-9 place-items-center rounded-full text-xs font-black transition ${
                selectedId === sub.id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-white text-muted-foreground ring-1 ring-border hover:bg-primary-soft hover:text-primary"
              }`}
              title={sub.name}
            >
              {sub.initial}
            </button>
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-border bg-secondary/25 p-3">
      <div className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-white px-3 py-2 shadow-sm ring-1 ring-border/80">
        <div className="min-w-0">
          <p className="text-sm font-black text-foreground">下属人员</p>
          <p className="mt-0.5 text-[11px] font-semibold text-muted-foreground">直接 {directSubs.length} 人 · 间接 {indirectSubs.length} 人</p>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-white text-muted-foreground transition hover:border-primary/35 hover:bg-primary-soft hover:text-primary"
          aria-label="收起下属列表"
          title="收起"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-2">
        <VersionThreeStatusCount label="待反馈" value={pendingFeedbackCount} tone="primary" />
        <VersionThreeStatusCount label="待提交" value={pendingSubmitCount} tone="warning" />
        <VersionThreeStatusCount label="已确认" value={confirmedCount} tone="muted" />
      </div>

      <div className="mb-2 flex items-center rounded-xl border border-border bg-white p-1 shadow-sm">
        {([
          ["direct", `直接下属 ${directSubs.length}`],
          ["indirect", `间接下属 ${indirectSubs.length}`],
        ] as const).map(([group, label]) => {
          const active = activeGroup === group;
          return (
            <button
              key={group}
              type="button"
              onClick={() => setActiveGroup(group)}
              className={`h-8 flex-1 rounded-lg px-2 text-xs font-black transition ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-primary-soft hover:text-accent-foreground"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="mb-3 flex items-center rounded-xl border border-border bg-white p-1 shadow-sm">
        {ORG_STATUS_FILTERS.map((filter) => {
          const active = statusFilter === filter.key;
          return (
            <button
              key={filter.key}
              type="button"
              onClick={() => setStatusFilter(filter.key)}
              className={`h-7 flex-1 whitespace-nowrap rounded-lg px-1.5 text-[11px] font-black transition ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-primary-soft hover:text-accent-foreground"
              }`}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {visibleSubs.length > 0 ? (
          visibleSubs.map((sub) => (
            <button
              key={sub.id}
              type="button"
              onClick={() => onSelect(sub)}
              className={`w-full rounded-xl border px-3 py-3 text-left transition hover:-translate-y-0.5 hover:border-primary/35 hover:bg-white ${
                selectedId === sub.id
                  ? "border-primary bg-white shadow-[0_12px_28px_rgba(36,87,214,0.12)]"
                  : "border-border bg-white/82 shadow-sm"
              }`}
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <Avatar initial={sub.initial} size="sm" src={getPersonAvatarUrl(sub.id, sub.name)} alt={sub.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-center gap-1.5">
                    <p className="truncate text-sm font-black text-foreground">{sub.name}</p>
                    <StatusPill status={sub.status} />
                  </div>
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{sub.title}</p>
                </div>
              </div>
            </button>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-border bg-white/85 px-3 py-8 text-center text-xs font-semibold text-muted-foreground">
            当前筛选下暂无下属
          </div>
        )}
      </div>
    </aside>
  );
}

function VersionThreeStatusCount({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "primary" | "warning" | "muted";
}) {
  const valueClass = tone === "warning" ? "text-warning" : tone === "muted" ? "text-slate-500" : "text-primary";
  return (
    <div className="rounded-xl border border-border bg-white px-2 py-2 text-center shadow-sm">
      <p className="text-[11px] font-black text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-xl font-black leading-none ${valueClass}`}>{value}</p>
    </div>
  );
}

function VersionOneReportWorkspace({
  activeTab,
  personalReportStatus,
  subs,
  selectedSub,
  submittedFeedbackBySubId,
  pendingFeedbackCount,
  notSubmittedCount,
  confirmedCount,
  notSubmittedSubs,
  v2PreviewSubId,
  detailPanelExpanded,
  cooldowns,
  onStartPersonalReport,
  onOpenPersonalDetail,
  onSelectSub,
  onPreviewSub,
  onClosePreview,
  onWriteFeedback,
  getRemindCooldownMs,
  onRemindSub,
  onRemind,
  onBackToTeam,
  onToggleDetailExpanded,
}: {
  activeTab: ReportTabKey;
  personalReportStatus: PersonalMonthlyReportStatus;
  subs: Subordinate[];
  selectedSub: Subordinate | null;
  submittedFeedbackBySubId: Record<string, SubmittedFeedback>;
  submittedPersonalReports: Record<string, SubmittedPersonalMonthlyReport>;
  pendingFeedbackCount: number;
  notSubmittedCount: number;
  confirmedCount: number;
  notSubmittedSubs: Subordinate[];
  v2PreviewSubId: string | null;
  detailPanelExpanded: boolean;
  cooldowns: Record<string, number>;
  onStartPersonalReport: () => void;
  onOpenPersonalDetail: () => void;
  onSelectSub: (sub: Subordinate) => void;
  onPreviewSub: (sub: Subordinate) => void;
  onClosePreview: () => void;
  onWriteFeedback: (sub: Subordinate) => void;
  getRemindCooldownMs: (id: string) => number;
  onRemindSub: (sub: Subordinate) => void;
  onRemind: (ids: string[]) => void;
  onBackToTeam: () => void;
  onToggleDetailExpanded: () => void;
}) {
  const pendingFeedbackSubs = subs.filter((s) => s.status === "pending_feedback");

  if (activeTab !== "monthly") {
    return <ReportCyclePlaceholder activeTab={activeTab} />;
  }

  return (
    <div className="p-5">
      <MonthlyReportTaskDashboard
              personalReportStatus={personalReportStatus}
              onStartPersonalReport={onStartPersonalReport}
              onOpenPersonalDetail={onOpenPersonalDetail}
            />

      <div className="relative mt-4 flex items-start gap-6">
        <div className="w-[360px] shrink-0">
          <OrgChartPanel
            subs={subs}
            selectedId={selectedSub?.id}
            activeVersion="v1"
            previewSubId={v2PreviewSubId}
            pendingFeedbackCount={pendingFeedbackCount}
            notSubmittedCount={notSubmittedCount}
            confirmedCount={confirmedCount}
            pendingFeedbackSubs={pendingFeedbackSubs}
            notSubmittedSubs={notSubmittedSubs}
            cooldowns={cooldowns}
            submittedFeedbackBySubId={submittedFeedbackBySubId}
            onSelect={onSelectSub}
            onPreviewSub={onPreviewSub}
            onClosePreview={onClosePreview}
            onWriteFeedback={onWriteFeedback}
            getRemindCooldownMs={getRemindCooldownMs}
            onRemindSub={onRemindSub}
            onRemind={onRemind}
          />
        </div>
        <section
          className={`rounded-2xl border border-border bg-card overflow-hidden ${
            detailPanelExpanded
              ? "absolute inset-0 z-20 h-[calc(100vh-20rem)] min-h-[520px] shadow-[0_24px_70px_rgba(15,23,42,0.16)]"
              : "h-[calc(100vh-20rem)] min-h-[520px] min-w-[420px] flex-1 resize-x"
          }`}
        >
          {selectedSub ? (
            <SubordinatePerformancePanel
              sub={selectedSub}
              submittedFeedback={submittedFeedbackBySubId[selectedSub.id]}
              onWriteFeedback={() => onWriteFeedback(selectedSub)}
              remindCooldownMs={getRemindCooldownMs(selectedSub.id)}
              onRemind={() => onRemindSub(selectedSub)}
              onBackToTeam={onBackToTeam}
              showExpandButton
              expanded={detailPanelExpanded}
              onToggleExpanded={onToggleDetailExpanded}
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary-soft text-primary">
                <FileText className="h-5 w-5" />
              </div>
              <p className="mt-4 text-sm font-bold text-foreground">选择下属汇报进行处理</p>
              <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">
                可从左侧组织架构快速切换下属，查看月度汇报并填写主管反馈。
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

function MonthlyReportTaskDashboard({
  personalReportStatus,
  onStartPersonalReport,
  onOpenPersonalDetail,
}: {
  personalReportStatus: PersonalMonthlyReportStatus;
  onStartPersonalReport: () => void;
  onOpenPersonalDetail: () => void;
}) {
  const latestFeedback = PERSONAL_SUPERVISOR_FEEDBACK[0];
  const statusMeta: Record<PersonalMonthlyReportStatus, { label: string; tone: "primary" | "warning" | "success"; title: string; detail: string }> = {
    pending_submit: {
      label: "待提交",
      tone: "primary",
      title: "本期月度汇报待提交",
      detail: "",
    },
    waiting_feedback: {
      label: "待主考反馈",
      tone: "warning",
      title: "已提交，等待主考反馈",
      detail: `月度汇报已提交给 ${CURRENT_USER.supervisor}，当前等待主考反馈结果同步。`,
    },
    feedback_done: {
      label: "主考已反馈",
      tone: "success",
      title: "主考已完成反馈",
      detail: `${latestFeedback.period} 主考评分 ${latestFeedback.score} 分，${latestFeedback.rating}。`,
    },
  };
  const currentStatus = statusMeta[personalReportStatus];
  const statusClass =
    currentStatus.tone === "success"
      ? "bg-success-soft text-success"
      : currentStatus.tone === "warning"
        ? "bg-warning-soft text-warning"
        : "bg-primary-soft text-primary";

  return (
    <section className="rounded-2xl border border-border bg-white p-4 shadow-[0_14px_34px_rgba(26,39,63,0.06)]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <span className="rounded-full bg-secondary px-3 py-1 text-xs font-bold text-muted-foreground">
          {CURRENT_PERIOD} 当前周期
        </span>
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(300px,0.85fr)_minmax(0,1.25fr)]">
        <button
          type="button"
          onClick={onOpenPersonalDetail}
          className="group flex min-w-0 items-center gap-4 rounded-xl border border-border bg-white p-4 text-left shadow-[0_8px_22px_rgba(26,39,63,0.04)] transition hover:border-primary/30 hover:bg-primary-soft/15"
        >
          <img
            src={MANAGER_AVATAR_URL}
            alt={CURRENT_USER.name}
            className="h-16 w-16 shrink-0 rounded-2xl object-cover shadow-sm ring-1 ring-white"
          />
          <span className="min-w-0 flex-1">
            <span className="block text-lg font-black text-foreground">{CURRENT_USER.name}</span>
            <span className="mt-1 block truncate text-xs font-semibold text-muted-foreground">{CURRENT_USER.company}</span>
            <span className="mt-1 block line-clamp-2 text-xs leading-relaxed text-muted-foreground">{CURRENT_USER.title}</span>
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
        </button>

        <article className="rounded-xl border border-primary/15 bg-primary-soft/15 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-black text-foreground">{currentStatus.title}</p>
                <span className={`rounded-full px-2.5 py-1 text-xs font-black ${statusClass}`}>{currentStatus.label}</span>
              </div>
              {currentStatus.detail && <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{currentStatus.detail}</p>}
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              {personalReportStatus === "pending_submit" ? (
                <button
                  type="button"
                  onClick={onStartPersonalReport}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground transition hover:bg-primary/90"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  去填写
                </button>
              ) : personalReportStatus === "waiting_feedback" ? (
                <button
                  type="button"
                  onClick={onStartPersonalReport}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-primary/25 bg-white px-3 text-xs font-bold text-primary transition hover:bg-primary-soft"
                >
                  查看当前汇报
                </button>
              ) : (
              <button
                type="button"
                onClick={onOpenPersonalDetail}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground transition hover:bg-primary/90"
              >
                查看反馈结果
              </button>
              )}
            </div>
          </div>
          {personalReportStatus === "feedback_done" && (
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <FeedbackCompactLine label="亮点" text={latestFeedback.highlights} tone="success" />
              <FeedbackCompactLine label="不足" text={latestFeedback.shortcomings} tone="warning" />
              <FeedbackCompactLine label="重点" text={latestFeedback.nextFocus} tone="primary" />
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

function ReportTaskCard({
  title,
  value,
  detail,
  tone,
  actionLabel,
  action,
  onAction,
}: {
  title: string;
  value: string;
  detail: string;
  tone: "primary" | "warning" | "success";
  actionLabel?: string;
  action?: React.ReactNode;
  onAction?: () => void;
}) {
  const toneClass =
    tone === "success"
      ? "bg-success-soft text-success"
      : tone === "warning"
        ? "bg-warning-soft text-warning"
        : "bg-primary-soft text-primary";

  return (
    <article className="flex min-h-[142px] flex-col rounded-xl border border-border bg-white p-3 shadow-[0_8px_22px_rgba(26,39,63,0.04)]">
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-black text-foreground">{title}</p>
        <span className={`rounded-full px-2.5 py-1 text-xs font-black ${toneClass}`}>{value}</span>
      </div>
      <p className="mt-3 flex-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
      <div className="mt-3">
        {action ?? (
          <button
            type="button"
            onClick={onAction}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-xs font-bold text-primary-foreground transition hover:bg-primary/90"
          >
            <Pencil className="h-3.5 w-3.5" />
            {actionLabel}
          </button>
        )}
      </div>
    </article>
  );
}

function ReportCyclePlaceholder({ activeTab }: { activeTab: ReportTabKey }) {
  const title = activeTab === "midyear" ? "年中汇报" : "年终汇报";
  return (
    <section className="flex h-[calc(100vh-3.5rem)] items-center justify-center bg-background p-5">
      <div className="w-full max-w-xl rounded-2xl border border-border bg-white p-8 text-center shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary">
          <FileText className="h-6 w-6" />
        </div>
        <p className="mt-5 text-lg font-black text-foreground">{title}</p>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {title}入口已预留，后续可接入对应周期的汇报任务、组织反馈和 AI 辅助流程。
        </p>
      </div>
    </section>
  );
}

function PersonalDirectReportDialog({
  onClose,
  onSubmitted,
}: {
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const defaultNotes = () => Object.fromEntries(PERSONAL_ITEMS.map((item) => [item.id, item.aiNote]));
  const defaultScores = () => Object.fromEntries(PERSONAL_ITEMS.map((item) => [item.id, getDefaultPersonalSelfScore(item)]));
  const [notes, setNotes] = useState<Record<string, string>>(defaultNotes);
  const [scores, setScores] = useState<Record<string, number | undefined>>(defaultScores);
  const initialReport = buildPersonalReport(notes, scores);
  const [summary, setSummary] = useState(initialReport.summary);
  const [saving, setSaving] = useState(false);
  const [emailDraft, setEmailDraft] = useState<FeedbackEmailDraft | null>(null);
  const fieldCls =
    "w-full resize-none rounded-lg border border-border bg-primary-soft/20 p-3 text-xs leading-relaxed text-foreground focus:border-primary/35 focus:outline-none focus:ring-2 focus:ring-primary/20";

  const buildCurrentReport = () => ({ ...buildPersonalReport(notes, scores), summary });

  const saveDraft = async () => {
    setSaving(true);
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    setSaving(false);
    toast.success("个人汇报草稿已保存");
  };

  const submit = async () => {
    setSaving(true);
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    setSaving(false);
    onSubmitted();
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-slate-950/25 px-4 pt-12">
      <section className="flex max-h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-[0_28px_90px_rgba(15,23,42,0.22)]">
        <div className="flex items-start justify-between gap-4 border-b border-border bg-primary-soft/45 px-6 py-5">
          <div className="min-w-0">
            <p className="text-lg font-black tracking-tight text-foreground">直接填写月度汇报</p>
            <p className="mt-1 text-sm text-muted-foreground">不使用 AI 生成时，可在这里直接编辑综合汇报、逐项进展和自评分。</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="grid h-9 w-9 place-items-center rounded-xl text-muted-foreground transition hover:bg-white/70 hover:text-foreground disabled:opacity-50"
            aria-label="关闭直接填写"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <label className="block rounded-2xl border border-primary/15 bg-primary-soft/15 p-4">
            <span className="text-sm font-black text-foreground">综合汇报</span>
            <textarea
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              rows={5}
              className={`${fieldCls} mt-3 bg-white`}
            />
          </label>

          <div className="mt-4 space-y-3">
            <p className="text-sm font-black text-foreground">核心 KPI 与关键工作进展</p>
            {PERSONAL_ITEMS.map((item) => {
              const tagCls = item.tag === "核心KPI"
                ? "bg-primary-soft text-accent-foreground"
                : "bg-success-soft text-success";
              return (
                <div key={item.id} className="rounded-2xl border border-border bg-white p-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${tagCls}`}>{item.tag}</span>
                    <span className="min-w-0 flex-1 truncate text-xs font-bold text-foreground">{item.title}</span>
                    {item.weight && <span className="text-[10px] font-semibold text-muted-foreground">{item.weight}</span>}
                  </div>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">目标：{item.goal}</p>
                  <div className="mt-2 grid gap-3 md:grid-cols-[minmax(0,1fr)_92px]">
                    <textarea
                      value={notes[item.id] ?? ""}
                      onChange={(event) => setNotes({ ...notes, [item.id]: event.target.value })}
                      rows={3}
                      className={fieldCls}
                    />
                    <label className="block">
                      <span className="text-[11px] font-semibold text-muted-foreground">自评分</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={scores[item.id] ?? ""}
                        onChange={(event) => {
                          const value = normalizeScore(event.target.value);
                          setScores({ ...scores, [item.id]: value ?? undefined });
                        }}
                        className="mt-2 h-9 w-full rounded-lg border border-border bg-white text-center text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 border-t border-border bg-secondary/20 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-border bg-white px-4 py-2.5 text-sm font-semibold text-foreground transition hover:bg-secondary disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={saveDraft}
            disabled={saving}
            className="rounded-xl border border-primary/30 bg-white px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary-soft disabled:opacity-50"
          >
            保存草稿
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving || !summary.trim()}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            录入系统
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function PersonalReportWritingPanel({
  activeMode,
  onModeChange,
  onSubmitted,
  aiContent,
}: {
  activeMode: PersonalReportWorkMode;
  onModeChange: (mode: PersonalReportWorkMode) => void;
  onSubmitted: (report: SubmittedPersonalMonthlyReport) => void;
  aiContent: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="border-b border-border bg-white px-4 py-3">
        <div className="flex h-9 items-center rounded-xl border border-border bg-background p-1">
          {([
            ["direct", "直接填写"],
            ["ai", "AI 助手填写"],
          ] as const).map(([mode, label]) => {
            const active = activeMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onModeChange(mode)}
                className={`h-7 flex-1 rounded-lg px-3 text-xs font-bold transition ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                aria-pressed={active}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
      {activeMode === "direct" ? (
        <PersonalDirectReportPanel onSubmitted={onSubmitted} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">{aiContent}</div>
      )}
    </div>
  );
}

function PersonalDirectReportPanel({ onSubmitted }: { onSubmitted: (report: SubmittedPersonalMonthlyReport) => void }) {
  const defaultNotes = () => Object.fromEntries(PERSONAL_ITEMS.map((item) => [item.id, item.aiNote]));
  const defaultScores = () => Object.fromEntries(PERSONAL_ITEMS.map((item) => [item.id, getDefaultPersonalSelfScore(item)]));
  const [notes, setNotes] = useState<Record<string, string>>(defaultNotes);
  const [scores, setScores] = useState<Record<string, number | undefined>>(defaultScores);
  const initialReport = buildPersonalReport(notes, scores);
  const [summary, setSummary] = useState(initialReport.summary);
  const [saving, setSaving] = useState(false);
  const [emailDraft, setEmailDraft] = useState<FeedbackEmailDraft | null>(null);
  const fieldCls =
    "w-full resize-none rounded-lg border border-border bg-primary-soft/20 p-3 text-xs leading-relaxed text-foreground focus:border-primary/35 focus:outline-none focus:ring-2 focus:ring-primary/20";

  const buildCurrentReport = () => ({ ...buildPersonalReport(notes, scores), summary });

  const saveDraft = async () => {
    setSaving(true);
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    setSaving(false);
    toast.success("个人汇报草稿已保存");
  };

  const submit = async () => {
    setSaving(true);
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    setSaving(false);
    const nextReport = buildCurrentReport();
    onSubmitted(buildSubmittedPersonalMonthlyReport(nextReport));
  };

  const submitAndOpenEmail = async () => {
    setSaving(true);
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    setSaving(false);
    const nextReport = buildCurrentReport();
    onSubmitted(buildSubmittedPersonalMonthlyReport(nextReport));
    setEmailDraft(buildPersonalReportEmailDraft(nextReport));
  };

  const confirmEmailSend = () => {
    setEmailDraft(null);
    toast.success(`汇报邮件已发送给 ${PERSONAL_REPORT_EMAIL_SUPERVISOR}，并抄送 ${PERSONAL_REPORT_EMAIL_CC}`);
  };

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <label className="block rounded-2xl border border-primary/15 bg-primary-soft/15 p-4">
          <span className="text-sm font-black text-foreground">综合汇报</span>
          <textarea
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            rows={5}
            className={`${fieldCls} mt-3 bg-white`}
          />
        </label>

        <div className="mt-4 space-y-3">
          <p className="text-sm font-black text-foreground">核心 KPI 与关键工作进展</p>
          {PERSONAL_ITEMS.map((item) => {
            const tagCls = item.tag === "核心KPI"
              ? "bg-primary-soft text-accent-foreground"
              : "bg-success-soft text-success";
            return (
              <div key={item.id} className="rounded-2xl border border-border bg-white p-3 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold ${tagCls}`}>{item.tag}</span>
                  <span className="min-w-0 flex-1 truncate text-xs font-bold text-foreground">{item.title}</span>
                  {item.weight && <span className="text-[10px] font-semibold text-muted-foreground">{item.weight}</span>}
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">目标：{item.goal}</p>
                <div className="mt-2 grid gap-3 md:grid-cols-[minmax(0,1fr)_92px]">
                  <textarea
                    value={notes[item.id] ?? ""}
                    onChange={(event) => setNotes({ ...notes, [item.id]: event.target.value })}
                    rows={3}
                    className={fieldCls}
                  />
                  <label className="block">
                    <span className="text-[11px] font-semibold text-muted-foreground">自评分</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={scores[item.id] ?? ""}
                      onChange={(event) => {
                        const value = normalizeScore(event.target.value);
                        setScores({ ...scores, [item.id]: value ?? undefined });
                      }}
                      className="mt-2 h-9 w-full rounded-lg border border-border bg-white text-center text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </label>
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 border-t border-border bg-secondary/20 px-4 py-3">
        <button
          type="button"
          onClick={saveDraft}
          disabled={saving}
          className="rounded-xl border border-primary/30 bg-white px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary-soft disabled:opacity-50"
        >
          保存草稿
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={saving || !summary.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          录入系统
        </button>
        <button
          type="button"
          onClick={submitAndOpenEmail}
          disabled={saving || !summary.trim()}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/25 bg-white px-3 py-2.5 text-xs font-bold text-primary shadow-sm transition hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          录入系统并发送邮件
        </button>
      </div>
      {emailDraft && (
        <FeedbackEmailDialog
          draft={emailDraft}
          subName={CURRENT_USER.name}
          sending={false}
          onChange={setEmailDraft}
          onClose={() => setEmailDraft(null)}
          onConfirm={confirmEmailSend}
        />
      )}
    </>
  );
}

function FeedbackWritingPanel({
  selectedSub,
  activeMode,
  onModeChange,
  onSubmitted,
  aiContent,
}: {
  selectedSub: Subordinate | null;
  activeMode: FeedbackWorkMode;
  onModeChange: (mode: FeedbackWorkMode) => void;
  onSubmitted: (subId: string, feedback: SubmittedFeedback) => void;
  aiContent: React.ReactNode;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col bg-white">
      <div className="border-b border-border bg-white px-4 py-3">
        <div className="flex h-9 items-center rounded-xl border border-border bg-background p-1">
          {([
            ["direct", "直接填写"],
            ["ai", "AI 辅助填写"],
          ] as const).map(([mode, label]) => {
            const active = activeMode === mode;
            return (
              <button
                key={mode}
                type="button"
                onClick={() => onModeChange(mode)}
                className={`h-7 flex-1 rounded-lg px-3 text-xs font-bold transition ${
                  active
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                aria-pressed={active}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>
      {activeMode === "direct" ? (
        <DirectFeedbackPanel selectedSub={selectedSub} onSubmitted={onSubmitted} />
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">{aiContent}</div>
      )}
    </div>
  );
}

function DirectFeedbackPanel({
  selectedSub,
  onSubmitted,
}: {
  selectedSub: Subordinate | null;
  onSubmitted: (subId: string, feedback: SubmittedFeedback) => void;
}) {
  const buildInitialDraft = () => {
    const scoreMap = getDefaultFeedbackScores();
    const score = computeDirectFeedbackScore(scoreMap);
    return {
      score,
      highlights: "",
      shortcomings: "",
      nextFocus: "",
      feedbackText: "",
    };
  };
  const [draft, setDraft] = useState<FeedbackDraft>(() => buildInitialDraft());
  const [scoreMap, setScoreMap] = useState<Record<string, number>>(getDefaultFeedbackScores);
  const [saving, setSaving] = useState(false);
  const [emailContext, setEmailContext] = useState<{ sub: Subordinate; draft: FeedbackEmailDraft } | null>(null);
  const fieldCls =
    "mt-2 w-full resize-y rounded-xl border border-border bg-primary-soft/20 px-3 py-2.5 text-xs leading-5 text-foreground focus:border-primary/35 focus:outline-none focus:ring-2 focus:ring-primary/20";

  useEffect(() => {
    const nextScores = getDefaultFeedbackScores();
    setScoreMap(nextScores);
    setDraft(buildInitialDraft());
  }, [selectedSub?.id]);

  const updateScore = (id: string, value: number | undefined) => {
    const next = { ...scoreMap };
    if (value == null) delete next[id];
    else next[id] = value;
    setScoreMap(next);
    setDraft((current) => ({ ...current, score: computeDirectFeedbackScore(next) }));
  };

  const buildSubmittedFeedback = (): SubmittedFeedback => ({
    period: getCurrentMonthPeriod(),
    submittedAt: new Date().toISOString(),
    score: draft.score,
    highlights: draft.highlights,
    shortcomings: draft.shortcomings,
    nextFocus: draft.nextFocus,
  });

  const submit = async () => {
    if (!selectedSub) return;
    setSaving(true);
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    onSubmitted(selectedSub.id, buildSubmittedFeedback());
    setSaving(false);
    toast.success("反馈已录入系统");
  };

  const submitAndEmail = async () => {
    if (!selectedSub) return;
    const submittedSub = selectedSub;
    setSaving(true);
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    onSubmitted(submittedSub.id, buildSubmittedFeedback());
    setEmailContext({ sub: submittedSub, draft: buildFeedbackEmailDraft(submittedSub, draft, scoreMap) });
    setSaving(false);
  };

  const confirmEmailSend = () => {
    if (!emailContext) return;
    const sentSub = emailContext.sub;
    setEmailContext(null);
    toast.success(`反馈邮件已发送给 ${getFeedbackRecipientName(sentSub)}`);
  };

  if (!selectedSub) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-sm text-muted-foreground">
        请选择待反馈下属后填写反馈。
      </div>
    );
  }

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <section className="rounded-2xl border border-primary/15 bg-primary-soft/15 p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-black text-foreground">综合反馈</p>
            <label className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
              综合评分
              <input
                type="number"
                min={0}
                max={100}
                value={draft.score}
                onChange={(event) => {
                  const value = normalizeScore(event.target.value);
                  if (value != null) setDraft((current) => ({ ...current, score: value }));
                }}
                className="h-9 w-20 rounded-lg border border-border bg-white text-center text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </label>
          </div>
          <div className="mt-3 grid gap-3">
            <label className="block">
              <span className="text-xs font-bold text-success">工作亮点</span>
              <textarea value={draft.highlights} onChange={(e) => setDraft((current) => ({ ...current, highlights: e.target.value }))} rows={4} className={fieldCls} />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-warning">存在不足</span>
              <textarea value={draft.shortcomings} onChange={(e) => setDraft((current) => ({ ...current, shortcomings: e.target.value }))} rows={4} className={fieldCls} />
            </label>
            <label className="block">
              <span className="text-xs font-bold text-primary">下月重点</span>
              <textarea value={draft.nextFocus} onChange={(e) => setDraft((current) => ({ ...current, nextFocus: e.target.value }))} rows={4} className={fieldCls} />
            </label>
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-border bg-white p-3 shadow-sm">
          <p className="px-1 text-xs font-black text-muted-foreground">核心 KPI 主考评分</p>
          <div className="mt-2 space-y-1">
            {KPI_SCORE_ITEMS.map((item) => (
              <ScoreRow
                key={item.id}
                tag={item.tag}
                tagColor="kpi"
                title={`${item.title}（${item.weight}）`}
                value={scoreMap[item.id]}
                placeholder={String(item.self)}
                invalid={false}
                onChange={(value) => updateScore(item.id, value)}
              />
            ))}
          </div>
        </section>

        <section className="mt-4 rounded-2xl border border-border bg-white p-3 shadow-sm">
          <p className="px-1 text-xs font-black text-muted-foreground">关键工作主考评分</p>
          <div className="mt-2 space-y-1">
            {KEY_WORK_SCORE_ITEMS.map((item) => (
              <ScoreRow
                key={item.id}
                tag={item.tag}
                tagColor="work"
                title={item.title}
                value={scoreMap[item.id]}
                placeholder={String(item.self)}
                invalid={false}
                onChange={(value) => updateScore(item.id, value)}
              />
            ))}
          </div>
        </section>
      </div>
      <div className="grid grid-cols-2 gap-2 border-t border-border bg-secondary/20 px-4 py-3">
        <button
          type="button"
          onClick={submit}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          录入系统
        </button>
        <button
          type="button"
          onClick={submitAndEmail}
          disabled={saving}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/25 bg-white px-3 py-2.5 text-xs font-bold text-primary shadow-sm transition hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
          录入系统并发送邮件
        </button>
      </div>
      {emailContext && (
        <FeedbackEmailDialog
          draft={emailContext.draft}
          subName={emailContext.sub.name}
          sending={saving}
          onChange={(draft) => setEmailContext((context) => context ? { ...context, draft } : null)}
          onClose={() => setEmailContext(null)}
          onConfirm={confirmEmailSend}
        />
      )}
    </>
  );
}

function FocusedPerformanceWorkspace({
  context,
  selectedSub,
  submittedFeedbackBySubId,
  submittedPersonalReports,
  feedbackSwitchSubs,
  onSwitchFeedbackSub,
  onWriteFeedback,
  onRemindSub,
  getRemindCooldownMs,
  onExit,
}: {
  context: AIWorkContext;
  selectedSub: Subordinate | null;
  submittedFeedbackBySubId: Record<string, SubmittedFeedback>;
  submittedPersonalReports: Record<string, SubmittedPersonalMonthlyReport>;
  feedbackSwitchSubs: Subordinate[];
  onSwitchFeedbackSub: (sub: Subordinate) => void;
  onWriteFeedback: (sub: Subordinate) => void;
  onRemindSub: (sub: Subordinate) => void;
  getRemindCooldownMs: (id: string) => number;
  onExit: () => void;
}) {
  const isReport = context === "personal_report";
  const sub = isReport ? MANAGER_DETAIL_SUB : selectedSub;
  const switchIndex = selectedSub ? feedbackSwitchSubs.findIndex((item) => item.id === selectedSub.id) : -1;
  const switchCount = feedbackSwitchSubs.length;
  const switchFeedback = (step: -1 | 1) => {
    if (!switchCount) return;
    const currentIndex = switchIndex >= 0 ? switchIndex : 0;
    const nextIndex = (currentIndex + step + switchCount) % switchCount;
    onSwitchFeedbackSub(feedbackSwitchSubs[nextIndex]);
  };

  return (
    <section className="h-[calc(100vh-3.5rem)] min-h-0 bg-slate-50 p-4">
      <div className="mb-3 flex h-10 items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-900">
            {isReport ? "写汇报" : `写反馈 · ${sub?.name ?? "绩效详情"}`}
          </p>
        </div>
        {!isReport && switchCount > 0 && (
          <div className="ml-auto flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => switchFeedback(-1)}
              disabled={switchCount <= 1}
              className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-white text-muted-foreground transition hover:border-primary/35 hover:bg-primary-soft hover:text-primary"
              aria-label="切换到上一个待反馈下属"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold text-muted-foreground ring-1 ring-border">
              {switchIndex >= 0 ? switchIndex + 1 : 1}/{switchCount}
            </span>
            <button
              type="button"
              onClick={() => switchFeedback(1)}
              disabled={switchCount <= 1}
              className="grid h-8 w-8 place-items-center rounded-lg border border-border bg-white text-muted-foreground transition hover:border-primary/35 hover:bg-primary-soft hover:text-primary"
              aria-label="切换到下一个待反馈下属"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={onExit}
          className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-bold text-muted-foreground transition hover:border-primary/35 hover:bg-primary-soft hover:text-accent-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          返回工作台
        </button>
      </div>

      <div className="h-[calc(100%-3.25rem)] min-h-0 overflow-hidden rounded-2xl border border-border bg-white shadow-[0_18px_44px_rgba(15,23,42,0.08)]">
        {sub ? (
          <SubordinatePerformancePanel
            sub={sub}
            submittedFeedback={isReport ? undefined : submittedFeedbackBySubId[sub.id]}
            onWriteFeedback={() => !isReport && onWriteFeedback(sub)}
            onRemind={() => !isReport && onRemindSub(sub)}
            remindCooldownMs={isReport ? 0 : getRemindCooldownMs(sub.id)}
            compact={false}
            expanded
            isManager={isReport}
            submittedPersonalReports={isReport ? submittedPersonalReports : undefined}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8 text-sm text-muted-foreground">
            请选择下属后再写反馈。
          </div>
        )}
      </div>
    </section>
  );
}

type AssessmentRow = {
  id: string;
  name: string;
  title: string;
  rank: string;
  rankBand: string;
  ability: "完全胜任" | "基本胜任" | "超越胜任" | "继续观察" | "--";
  score: number | "--";
  trend: "↑" | "→" | "--";
  managerZone: string;
  comment: string;
  status: "待反馈" | "未提交" | "已催办" | "已确认";
};

const ASSESSMENT_RANK_BANDS = [
  { label: "[100%-90%]", caption: "0人", x: 9 },
  { label: "[90%-70%]", caption: "1人", x: 23 },
  { label: "[70%-40%]", caption: "1人", x: 47 },
  { label: "[40%-20%]", caption: "1人", x: 70 },
  { label: "[20%-10%]", caption: "1人", x: 84 },
  { label: "[10%-0%]", caption: "2人", x: 94 },
] as const;

const ASSESSMENT_LEVELS = [
  { label: "超越胜任", y: 20, count: "0人" },
  { label: "完全胜任", y: 42, count: "4人" },
  { label: "基本胜任", y: 63, count: "2人" },
  { label: "继续观察", y: 82, count: "0人" },
] as const;

const SECOND_ASSESSOR = {
  name: "马明哲",
  title: "集团董事长",
  company: "平安集团",
};

const ASSESSMENT_ROWS: AssessmentRow[] = [
  {
    id: "a1",
    name: "丁珂珂",
    title: "产险公司副总经理",
    rank: "前10%",
    rankBand: "[10%-0%]",
    ability: "完全胜任",
    score: 85,
    trend: "↑",
    managerZone: "--",
    comment: "个非健康险创新取得进展；智小安AI工具得到监管及行业认可。车险、个非、新客数和平台线销模式仍需重点提升。",
    status: "待反馈",
  },
  {
    id: "a2",
    name: "史良洵",
    title: "产险公司总经理",
    rank: "前10%",
    rankBand: "[10%-0%]",
    ability: "完全胜任",
    score: "--",
    trend: "↑",
    managerZone: "--",
    comment: "本月尚未提交工作汇报，等待提交后生成综合评价。",
    status: "未提交",
  },
  {
    id: "a3",
    name: "徐华",
    title: "产险总公司总经理助理",
    rank: "前20%",
    rankBand: "[20%-10%]",
    ability: "完全胜任",
    score: "--",
    trend: "↑",
    managerZone: "--",
    comment: "本月尚未提交工作汇报，等待提交后生成综合评价。",
    status: "未提交",
  },
  {
    id: "a4",
    name: "李亚男",
    title: "产险总公司总经理助理",
    rank: "前40%",
    rankBand: "[40%-20%]",
    ability: "完全胜任",
    score: "--",
    trend: "→",
    managerZone: "--",
    comment: "本月尚未提交工作汇报，等待提交后生成综合评价。",
    status: "未提交",
  },
  {
    id: "a5",
    name: "张振勇",
    title: "产险总公司总经理助理",
    rank: "前70%",
    rankBand: "[70%-40%]",
    ability: "基本胜任",
    score: "--",
    trend: "→",
    managerZone: "--",
    comment: "本月尚未提交工作汇报，等待提交后生成综合评价。",
    status: "未提交",
  },
  {
    id: "a6",
    name: "裴斌",
    title: "产险总部理赔运营中心作业管理团队总经理",
    rank: "后30%",
    rankBand: "[90%-70%]",
    ability: "基本胜任",
    score: "--",
    trend: "→",
    managerZone: "--",
    comment: "本月尚未提交工作汇报，等待提交后生成综合评价。",
    status: "未提交",
  },
];

function AssessmentDashboard({
  subs,
  selectedSub,
  submittedFeedbackBySubId,
  onSelectSub,
  onOpenPerformanceDetail,
  onWriteFeedback,
}: {
  subs: Subordinate[];
  selectedSub: Subordinate | null;
  submittedFeedbackBySubId: Record<string, SubmittedFeedback>;
  onSelectSub: (sub: Subordinate) => void;
  onOpenPerformanceDetail: () => void;
  onWriteFeedback: (sub: Subordinate) => void;
}) {
  const selectedAssessment = selectedSub
    ? ASSESSMENT_ROWS.find((row) => row.name === selectedSub.name)
    : ASSESSMENT_ROWS[0];

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[#f4f7fb]">
      <div className="space-y-6 px-5 py-5">
        <section className="rounded-[20px] border border-[#dbe5f0] bg-white p-5 shadow-[0_16px_38px_rgba(31,47,71,0.05)]">
          <AssessmentBlockHeader
            title="个人绩效考核信息"
          />

          <div className="mt-4 space-y-5">
            <PersonalAssessmentSummaryRow />
            <PersonalPerformanceDevelopmentMap />
          </div>
        </section>

        <section className="rounded-[20px] border border-[#dbe5f0] bg-white shadow-[0_16px_38px_rgba(31,47,71,0.05)]">
          <TeamPerformanceDevelopmentMap />
        </section>
      </div>
    </div>
  );
}

type DevelopmentPoint = {
  id: string;
  name: string;
  label: string;
  rank: string;
  ability: "超越胜任" | "完全胜任" | "基本胜任" | "继续观察";
  x: number;
  y: number;
  trend: "up" | "right" | "down" | "flat";
  score?: number | "--";
  note: string;
  active?: boolean;
  muted?: boolean;
  hideLabel?: boolean;
  labelDx?: number;
  labelDy?: number;
};

type DevelopmentCluster = {
  d: string;
};

type DevelopmentConnector = {
  points: DevelopmentPoint[];
  tone?: "muted" | "active";
};

const DEVELOPMENT_RANK_AXIS = [
  { label: "后10%", x: 32 },
  { label: "后30%", x: 62 },
  { label: "前70%", x: 95 },
  { label: "前40%", x: 130 },
  { label: "前20%", x: 165 },
  { label: "前10%", x: 200 },
] as const;

const DEVELOPMENT_LEVEL_AXIS = [
  { label: "超越胜任", y: 15.7 },
  { label: "完全胜任", y: 26.3 },
  { label: "基本胜任", y: 36.9 },
  { label: "继续观察", y: 47.5 },
] as const;

const rankBandToDevelopmentX: Record<string, number> = {
  "[90%-70%]": 62,
  "[70%-40%]": 95,
  "[40%-20%]": 130,
  "[20%-10%]": 165,
  "[10%-0%]": 200,
};

const abilityToDevelopmentY: Record<DevelopmentPoint["ability"], number> = {
  超越胜任: 15.7,
  完全胜任: 26.3,
  基本胜任: 36.9,
  继续观察: 47.5,
};

const PERSONAL_DEVELOPMENT_POINTS: DevelopmentPoint[] = [
  {
    id: "2016",
    name: CURRENT_USER.name,
    label: "16年\n入司",
    rank: "后30%",
    ability: "继续观察",
    x: 58,
    y: 45.4,
    trend: "right",
    note: "源图：16年入司，位于继续观察区。",
  },
  {
    id: "2017",
    name: CURRENT_USER.name,
    label: "17年",
    rank: "后30%",
    ability: "继续观察",
    x: 68,
    y: 42.4,
    trend: "up",
    note: "源图：17年位于继续观察区。",
  },
  {
    id: "2018",
    name: CURRENT_USER.name,
    label: "18年",
    rank: "前70%",
    ability: "基本胜任",
    x: 80,
    y: 34.6,
    trend: "right",
    note: "源图：18年进入基本胜任区。",
  },
  {
    id: "2019",
    name: CURRENT_USER.name,
    label: "19年",
    rank: "前70%",
    ability: "基本胜任",
    x: 94,
    y: 31.2,
    trend: "up",
    note: "源图：19年继续处于基本胜任区。",
  },
  {
    id: "2020",
    name: CURRENT_USER.name,
    label: "20年",
    rank: "前70%",
    ability: "继续观察",
    x: 84,
    y: 45.2,
    trend: "up",
    note: "源图：20年位于继续观察区。",
  },
  {
    id: "2021",
    name: CURRENT_USER.name,
    label: "21年",
    rank: "前40%",
    ability: "继续观察",
    x: 102,
    y: 42.8,
    trend: "up",
    note: "源图：21年位于继续观察区。",
  },
  {
    id: "2022",
    name: CURRENT_USER.name,
    label: "22年",
    rank: "前40%",
    ability: "基本胜任",
    x: 116,
    y: 34.2,
    trend: "right",
    note: "源图：22年回到基本胜任区。",
  },
  {
    id: "2023",
    name: CURRENT_USER.name,
    label: "23年",
    rank: "前20%",
    ability: "基本胜任",
    x: 130,
    y: 32.8,
    trend: "up",
    note: "源图：23年位于前20%附近。",
  },
  {
    id: "2024",
    name: CURRENT_USER.name,
    label: "24年",
    rank: "前20%",
    ability: "完全胜任",
    x: 136,
    y: 24.6,
    trend: "up",
    note: "源图：24年进入完全胜任区。",
  },
  {
    id: "2025",
    name: CURRENT_USER.name,
    label: "25年",
    rank: "前10%",
    ability: "超越胜任",
    x: 200,
    y: 14.6,
    trend: "up",
    note: "25年业绩排名调整为前10%，位于超越胜任区。",
    active: true,
  },
];

const PERSONAL_DEVELOPMENT_CONNECTORS: DevelopmentConnector[] = [
  { points: PERSONAL_DEVELOPMENT_POINTS, tone: "muted" },
];

const DIRECT_SUBORDINATE_DEVELOPMENT_CLUSTERS: DevelopmentCluster[] = [
  { d: "M 54 38 C 57 33 68 31 75 34 C 82 37 80 44 70 45 C 60 46 51 43 54 38 Z" },
  { d: "M 86 38 C 94 27 119 22 142 24 C 168 27 177 36 165 43 C 149 52 104 49 89 43 C 83 41 82 40 86 38 Z" },
  { d: "M 158 25 C 163 18 187 17 202 21 C 215 25 214 33 198 35 C 180 38 157 34 158 25 Z" },
];

const TEAM_DEVELOPMENT_POINTS: DevelopmentPoint[] = [
  {
    id: "team-shi",
    name: "史良洵",
    label: "史良洵",
    rank: "前70%",
    ability: "基本胜任",
    x: 92,
    y: 36.2,
    trend: "right",
    note: "史良洵：前70%，基本胜任。",
    labelDx: -2.5,
    labelDy: -3.4,
  },
  {
    id: "team-ding",
    name: "丁珂",
    label: "丁珂",
    rank: "前10%",
    ability: "完全胜任",
    x: 202,
    y: 25.6,
    trend: "up",
    note: "丁珂：前10%，完全胜任。",
    active: true,
    labelDx: 4,
    labelDy: 3.8,
  },
  {
    id: "team-xuhua",
    name: "徐华",
    label: "徐华",
    rank: "前20%",
    ability: "完全胜任",
    x: 162,
    y: 27.4,
    trend: "up",
    note: "徐华：前20%，完全胜任。",
    labelDx: 0,
    labelDy: 5,
  },
  {
    id: "team-zhang",
    name: "张振勇",
    label: "张振勇",
    rank: "前40%",
    ability: "基本胜任",
    x: 128,
    y: 38.4,
    trend: "right",
    note: "张振勇：前40%，基本胜任。",
    labelDx: 0,
    labelDy: 5,
  },
  {
    id: "team-xuting",
    name: "徐霆",
    label: "徐霆",
    rank: "前70%",
    ability: "基本胜任",
    x: 96,
    y: 39.4,
    trend: "right",
    note: "徐霆：前70%，基本胜任。",
    labelDx: 0,
    labelDy: 5,
  },
  {
    id: "team-han",
    name: "韩宪君",
    label: "韩宪君",
    rank: "前40%",
    ability: "基本胜任",
    x: 132,
    y: 34.8,
    trend: "up",
    note: "韩宪君：前40%，基本胜任。",
    labelDx: 0,
    labelDy: -3.6,
  },
  {
    id: "team-jiang",
    name: "姜华",
    label: "姜华",
    rank: "前70%",
    ability: "基本胜任",
    x: 99,
    y: 34.4,
    trend: "right",
    note: "姜华：前70%，基本胜任。",
    labelDx: 0,
    labelDy: -3.6,
  },
  {
    id: "team-cao",
    name: "曹敬之",
    label: "曹敬之",
    rank: "前70%",
    ability: "基本胜任",
    x: 88,
    y: 38.8,
    trend: "down",
    note: "曹敬之：前70%，基本胜任。",
    labelDx: -2.2,
    labelDy: 5,
  },
  {
    id: "team-zhuxi",
    name: "朱曦",
    label: "朱曦",
    rank: "前20%",
    ability: "完全胜任",
    x: 168,
    y: 24.8,
    trend: "up",
    note: "朱曦：前20%，完全胜任。",
    labelDx: 0,
    labelDy: -3.6,
  },
  {
    id: "team-li",
    name: "李亚男",
    label: "李亚男",
    rank: "后30%",
    ability: "基本胜任",
    x: 62,
    y: 35.8,
    trend: "right",
    note: "李亚男：后30%，基本胜任。",
    labelDx: 0,
    labelDy: -3.6,
  },
];

function PersonalPerformanceDevelopmentMap() {
  return (
    <section className="bg-white pt-1">
      <div>
        <DevelopmentMapCanvas
          title="个人发展评价地图"
          points={PERSONAL_DEVELOPMENT_POINTS}
          connectors={PERSONAL_DEVELOPMENT_CONNECTORS}
          activePointId="2025"
          kind="personal"
          heightClassName="h-[450px] 2xl:h-[500px]"
        />
      </div>
    </section>
  );
}

function TeamPerformanceDevelopmentMap() {
  return (
    <div className="px-5 py-5">
      <DevelopmentMapCanvas
        title="团队发展评价地图"
        summary="10人分布 · 3人完全胜任 · 7人基本胜任"
        points={TEAM_DEVELOPMENT_POINTS}
        activePointId="team-ding"
        kind="team"
        heightClassName="h-[460px] 2xl:h-[520px]"
      />
    </div>
  );
}

function DevelopmentMapHeader({
  summary,
}: {
  summary: string;
}) {
  return (
    <div className="flex min-h-8 items-center justify-end">
      <span className="rounded-full bg-primary-soft px-4 py-1.5 text-xs font-black text-primary shadow-[0_6px_16px_rgba(47,102,217,0.08)]">{summary}</span>
    </div>
  );
}

function DevelopmentMapCanvas({
  title,
  summary,
  points,
  connectors,
  clusters,
  activePointId,
  kind,
  heightClassName = "h-[460px]",
  onPointClick,
}: {
  title: string;
  summary?: string;
  points: DevelopmentPoint[];
  connectors?: DevelopmentConnector[];
  clusters?: DevelopmentCluster[];
  activePointId?: string;
  kind: "personal" | "team";
  heightClassName?: string;
  onPointClick?: (point: DevelopmentPoint) => void;
}) {
  const mapWidth = 220;
  const plotLeft = 12;
  const plotRight = 218;
  const plotTop = 8;
  const plotBottom = 50;
  const plotWidth = plotRight - plotLeft;
  const plotRows = [
    { y: 8, h: 10.5, label: "超越胜任" },
    { y: 18.5, h: 10.5, label: "完全胜任" },
    { y: 29, h: 10.5, label: "基本胜任" },
    { y: 39.5, h: 10.5, label: "继续观察" },
  ];

  return (
    <div className="min-w-0 overflow-hidden bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pb-2 pt-0">
        <p className="text-sm font-black text-slate-700">{title}</p>
        <div className="flex shrink-0 items-center">
          {summary && (
            <span className="rounded-full bg-primary-soft px-4 py-1.5 text-xs font-black text-primary shadow-[0_6px_16px_rgba(47,102,217,0.08)]">
              {summary}
            </span>
          )}
        </div>
      </div>
      <div className="overflow-x-auto">
        <svg
          viewBox={`0 0 ${mapWidth} 60`}
          preserveAspectRatio="xMidYMin meet"
          className={`${heightClassName} min-w-[1180px] w-full`}
          role="img"
          aria-label={title}
        >
          <defs>
            <filter id={`${kind}-point-shadow`} x="-60%" y="-60%" width="220%" height="220%">
              <feDropShadow dx="0" dy="0.6" stdDeviation="0.6" floodColor="#1d4ed8" floodOpacity="0.22" />
            </filter>
          </defs>

          <rect x="0" y="0" width={mapWidth} height="60" fill="#ffffff" />
          <rect x="0" y="0" width={mapWidth} height={plotTop} fill="#f3f6fa" />
          <rect x="0" y={plotBottom} width={mapWidth} height="5.2" fill="#f3f6fa" />
          <rect x="0" y={plotTop} width={plotLeft} height={plotBottom - plotTop} fill="#f7f9fc" />

          <text x="2" y="4.7" fill="#62728c" fontSize="2.2" fontWeight="800">管理区</text>
          <text x="13" y="4.7" fill="#62728c" fontSize="2.2" fontWeight="800">重点培养区</text>
          <text x="2" y="53.4" fill="#62728c" fontSize="2.2" fontWeight="800">管理区</text>
          <text x="13" y="53.4" fill="#62728c" fontSize="2.2" fontWeight="800">准备退出区</text>

          {plotRows.map((row) => (
            <g key={row.label}>
              <rect x="0" y={row.y} width={plotLeft} height={row.h} fill="#f7f9fc" />
              <text x="5.8" y={row.y + row.h / 2 + 0.7} textAnchor="middle" fill="#64748b" fontSize="2.15" fontWeight="800">
                {row.label}
              </text>
            </g>
          ))}

          {[plotTop, 18.5, 29, 39.5, plotBottom].map((y) => (
            <line key={`h-${y}`} x1={plotLeft} x2={mapWidth} y1={y} y2={y} stroke="#e6edf5" strokeWidth="0.42" />
          ))}
          {DEVELOPMENT_RANK_AXIS.map((rank) => (
            <line key={`grid-${rank.label}`} x1={rank.x} x2={rank.x} y1={plotTop} y2={plotBottom} stroke="#e6edf5" strokeWidth="0.42" />
          ))}
          {clusters?.map((cluster) => (
            <path
              key={cluster.d}
              d={cluster.d}
              fill="none"
              stroke="#334155"
              strokeWidth="0.46"
              strokeDasharray="2 1.6"
              opacity="0.9"
            />
          ))}
          {connectors?.map((connector, index) => (
            <polyline
              key={`connector-${index}`}
              points={connector.points.map((point) => `${point.x},${point.y}`).join(" ")}
              fill="none"
              stroke={connector.tone === "active" ? "#2f66d9" : "#c9cfd7"}
              strokeWidth={connector.tone === "active" ? "0.78" : "0.68"}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity="1"
            />
          ))}

          {points.map((point) => {
            const active = point.active || point.id === activePointId;
            const blue = point.muted ? "#8d939c" : active ? "#1f5fd3" : "#2f66d9";
            const labelDx = point.labelDx ?? 0;
            const labelDy = point.labelDy ?? 4.1;
            const pointTabIndex = onPointClick ? 0 : undefined;
            const arrow =
              point.trend === "right"
                ? `M ${point.x + 1.4} ${point.y - 0.7} L ${point.x + 3.4} ${point.y} L ${point.x + 1.4} ${point.y + 0.7} Z`
                : point.trend === "down"
                  ? `M ${point.x - 0.8} ${point.y + 1.7} L ${point.x} ${point.y + 3.1} L ${point.x + 0.8} ${point.y + 1.7} Z`
                  : point.trend === "up"
                    ? `M ${point.x - 0.8} ${point.y - 1.7} L ${point.x} ${point.y - 3.1} L ${point.x + 0.8} ${point.y - 1.7} Z`
                    : "";
            return (
              <g
                key={point.id}
                role={onPointClick ? "button" : undefined}
                tabIndex={pointTabIndex}
                aria-label={`${point.name} ${point.rank} ${point.ability}`}
                onClick={() => onPointClick?.(point)}
                onKeyDown={(event) => {
                  if (!onPointClick) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    onPointClick(point);
                  }
                }}
                className={onPointClick ? "cursor-pointer" : undefined}
              >
                {arrow && <path d={arrow} fill={blue} opacity="0.95" />}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={active ? 1.08 : 0.92}
                  fill={blue}
                  stroke="#ffffff"
                  strokeWidth="0.28"
                  filter={`url(#${kind}-point-shadow)`}
                />
                {!point.hideLabel && (
                  <text
                    x={point.x + labelDx}
                    y={point.y + labelDy}
                    fill={active ? "#1f5fd3" : "#62728c"}
                    fontSize="2.1"
                    fontWeight="800"
                    textAnchor={labelDx === 0 ? "middle" : labelDx < 0 ? "end" : "start"}
                  >
                    {point.label.split("\n").map((line, lineIndex) => (
                      <tspan key={line} x={point.x + labelDx} dy={lineIndex === 0 ? 0 : 2.6}>
                        {line}
                      </tspan>
                    ))}
                  </text>
                )}
                <title>{`${point.name}：${point.rank} / ${point.ability} / ${point.score ?? "--"}分。${point.note}`}</title>
              </g>
            );
          })}

          {DEVELOPMENT_RANK_AXIS.map((rank) => (
            <text key={rank.label} x={rank.x} y="59.2" textAnchor="middle" fill="#8b9bb4" fontSize="2.05" fontWeight="800">
              {rank.label}
            </text>
          ))}
          <text x={mapWidth - 1} y="57.3" textAnchor="end" fill="#8b9bb4" fontSize="2.05" fontWeight="800">业绩排名</text>
        </svg>
      </div>
    </div>
  );
}

function DevelopmentInsightPanel({
  title,
  items,
}: {
  title: string;
  items: Array<{ label: string; value: string }>;
}) {
  return (
    <aside className="rounded-xl border border-slate-200 bg-[#fbfcfe] p-4">
      <p className="text-xs font-black text-slate-800">{title}</p>
      <div className="mt-3 space-y-3">
        {items.map((item) => (
          <div key={item.label} className="border-b border-slate-100 pb-3 last:border-b-0 last:pb-0">
            <p className="text-[11px] font-bold text-slate-400">{item.label}</p>
            <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-600">{item.value}</p>
          </div>
        ))}
      </div>
    </aside>
  );
}

function AssessmentBlockHeader({ title }: { title: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex min-w-0 items-center gap-2">
        <span className="h-4 w-1 rounded-full bg-[#ff6b35]" />
        <h2 className="text-sm font-black text-slate-800">{title}</h2>
      </div>
      <span className="shrink-0 rounded-full bg-primary-soft px-3 py-1 text-xs font-bold text-primary">{CURRENT_PERIOD}</span>
    </div>
  );
}

function PersonalAssessmentSummaryRow() {
  return (
    <div className="rounded-2xl border border-[#dfe7f1] bg-[#f8fbff] p-4">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)_minmax(0,0.85fr)_minmax(0,1.45fr)]">
        <div className="flex min-w-0 items-center gap-3 rounded-xl bg-white p-3 shadow-[0_8px_20px_rgba(31,47,71,0.04)] ring-1 ring-slate-100">
          <img
            src={MANAGER_AVATAR_URL}
            alt={CURRENT_USER.name}
            className="h-14 w-14 shrink-0 rounded-xl object-cover shadow-sm ring-1 ring-white"
          />
          <div className="min-w-0">
            <p className="text-base font-black text-slate-900">{CURRENT_USER.name}</p>
            <p className="mt-1 truncate text-xs font-semibold text-slate-500">{CURRENT_USER.company}</p>
            <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500">{CURRENT_USER.title}</p>
          </div>
        </div>

        <AssessorInfoCard label="主考人信息" name={CURRENT_USER.supervisor} meta="集团联席首席执行官兼副总经理" />
        <AssessorInfoCard label="二考人信息" name={SECOND_ASSESSOR.name} meta={`${SECOND_ASSESSOR.company} · ${SECOND_ASSESSOR.title}`} />
        <PersonalAssessmentResultStrip />
      </div>
    </div>
  );
}

function AssessorInfoCard({ label, name, meta }: { label: string; name: string; meta: string }) {
  return (
    <div className="rounded-xl bg-white px-3 py-3 shadow-[0_8px_20px_rgba(31,47,71,0.04)] ring-1 ring-slate-100">
      <p className="text-[11px] font-bold text-slate-400">{label}</p>
      <div className="mt-2 flex min-w-0 items-center gap-2">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary-soft text-xs font-black text-primary">
          {name.slice(0, 1)}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-800">{name}</p>
          <p className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">{meta}</p>
        </div>
      </div>
    </div>
  );
}

function PersonalAssessmentResultStrip() {
  const resultItems = [
    { label: "综合绩效评估结果", value: "前10%" },
    { label: "综合能力", value: "超越胜任" },
    { label: "发展趋势", value: "箭头向上 ↑", accent: true },
  ];

  return (
    <div className="min-w-0 overflow-hidden rounded-xl bg-white shadow-[0_8px_20px_rgba(31,47,71,0.04)] ring-1 ring-slate-100">
      <div className="border-b border-slate-100 px-3 py-2">
        <p className="truncate text-[13px] font-black text-slate-900">个人综合绩效评估结果</p>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)] divide-x divide-slate-100">
        {resultItems.map((item) => (
          <div key={item.label} className="min-h-[74px] min-w-0 px-3 py-3">
            <p className="truncate text-[10px] font-bold text-slate-400">{item.label}</p>
            <p className={`mt-2 whitespace-nowrap text-[16px] font-black leading-tight 2xl:text-lg ${item.accent ? "text-[#ff5a1f]" : "text-slate-800"}`}>
              {item.value}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssessmentPlanCard({
  title,
  icon,
  count,
  items,
  tone = "blue",
}: {
  title: string;
  icon: React.ReactNode;
  count: string;
  items: Array<{ title: string; meta: string; detail: string }>;
  tone?: "blue" | "green";
}) {
  const badgeClass = tone === "green" ? "bg-success-soft text-success" : "bg-primary-soft text-primary";
  return (
    <section className="flex h-full min-h-0 flex-col rounded-2xl border border-[#dfe7f1] bg-white p-4 shadow-[0_10px_28px_rgba(31,47,71,0.04)]">
      <div className="mb-3 flex items-center gap-2">
        <div className={`grid h-8 w-8 place-items-center rounded-lg ${badgeClass}`}>{icon}</div>
        <p className="text-sm font-black text-slate-900">{title}</p>
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">{count}</span>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
        {items.map((item) => (
          <AssessmentPlanItem key={item.title} item={item} />
        ))}
      </div>
    </section>
  );
}

function AssessmentPlanItem({ item }: { item: { title: string; meta: string; detail: string } }) {
  const [expanded, setExpanded] = useState(false);
  const canToggle = item.detail.length > 46 || item.title.length > 16;
  return (
    <article className="rounded-lg bg-[#f7f9fc] px-3 py-2">
      <div className="flex items-start justify-between gap-2">
        <p className={`text-xs font-black text-slate-800 ${expanded ? "leading-relaxed" : "truncate"}`}>{item.title}</p>
        <div className="flex shrink-0 items-center gap-1">
          {item.meta !== "目标" && <span className="text-[10px] font-semibold text-slate-500">{item.meta}</span>}
          {canToggle && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="grid h-5 w-5 place-items-center rounded-full text-slate-400 transition hover:bg-white hover:text-primary"
              aria-label={expanded ? "收起内容" : "展开内容"}
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
      </div>
      <p className={`mt-1 text-[11px] leading-relaxed text-slate-500 ${canToggle && !expanded ? "line-clamp-1" : ""}`}>
        目标：{item.detail}
      </p>
    </article>
  );
}

function AssessmentDistributionChart({ selected }: { selected?: AssessmentRow }) {
  const rows = ASSESSMENT_ROWS.filter((row) => row.rankBand !== "--");
  const selectedRow = selected?.rankBand !== "--" ? selected : undefined;
  const labelOffsetById: Record<string, { dx: number; dy: number }> = {
    a1: { dx: -46, dy: -12 },
    a2: { dx: 42, dy: 12 },
    a3: { dx: -8, dy: -14 },
    a4: { dx: 12, dy: 12 },
    a5: { dx: -10, dy: 0 },
    a6: { dx: 10, dy: 0 },
  };
  const pointPosition = (row: AssessmentRow) => ({
    x: row.rankBand === "[90%-70%]" ? 32 : row.rankBand === "[70%-40%]" ? 58 : row.rankBand === "[40%-20%]" ? 72 : row.rankBand === "[20%-10%]" ? 83 : 92,
    y: row.ability === "完全胜任" ? 42 : row.ability === "基本胜任" ? 63 : row.ability === "超越胜任" ? 20 : 82,
  });

  return (
    <div className="px-5 pb-4 pt-3">
      <div className="text-xs font-semibold text-slate-500">综合能力</div>
      <div className="mt-2 grid grid-cols-[96px_minmax(720px,1fr)_44px] overflow-x-auto">
        <div className="flex h-8 items-center justify-center bg-[#f9fafb] text-xs font-semibold text-slate-400">管理区</div>
        <div className="flex h-8 items-center bg-[#fff2ed] px-4 text-xs font-semibold text-slate-600">重点培养：无</div>
        <div className="flex h-8 items-center justify-end bg-[#fff2ed] pr-2 text-xs font-semibold text-slate-500">共6人</div>

        <div className="grid h-[244px] grid-rows-4 bg-[#fafbfc] text-xs font-semibold text-slate-400">
          {ASSESSMENT_LEVELS.map((level) => (
            <div key={level.label} className="flex items-center justify-center border-b border-slate-100 last:border-b-0">
              {level.label}
            </div>
          ))}
        </div>
        <div className="relative h-[244px] bg-white">
          {[25, 50, 75].map((top) => (
            <span key={`h-${top}`} className="absolute left-0 right-0 h-px bg-slate-100" style={{ top: `${top}%` }} />
          ))}
          {ASSESSMENT_RANK_BANDS.map((band) => (
            <span key={`v-${band.label}`} className="absolute bottom-0 top-0 w-px bg-slate-100" style={{ left: `${band.x}%` }} />
          ))}
          {rows.map((row, index) => {
            const pos = pointPosition(row);
            const selectedPoint = selectedRow?.id === row.id;
            const offset = labelOffsetById[row.id] ?? { dx: index % 2 === 0 ? -10 : 10, dy: 0 };
            return (
              <button
                type="button"
                key={row.id}
                className={`absolute flex h-6 min-w-[78px] -translate-x-1/2 -translate-y-1/2 items-center justify-center gap-1 rounded-full px-2 text-[10px] font-bold transition ${
                  selectedPoint ? "z-10 bg-white text-primary shadow-[0_8px_18px_rgba(37,99,235,0.18)] ring-2 ring-primary/35" : "bg-white/80 text-slate-600 shadow-sm ring-1 ring-slate-100 hover:bg-white hover:text-primary"
                }`}
                style={{
                  left: `calc(${pos.x}% + ${offset.dx}px)`,
                  top: `calc(${pos.y}% + ${offset.dy}px)`,
                }}
                aria-label={`${row.name} ${row.rank} ${row.ability}`}
              >
                <span className={`h-3 w-3 rounded-sm ${selectedPoint ? "bg-primary" : "bg-slate-300"}`} />
                <span className="max-w-[42px] truncate">{row.name}</span>
                <span className={row.trend === "↑" ? "text-[#ff5a1f]" : "text-slate-500"}>{row.trend}</span>
              </button>
            );
          })}
        </div>
        <div className="relative h-[244px] bg-white">
          {ASSESSMENT_LEVELS.map((level) => (
            <span
              key={`${level.label}-count`}
              className="absolute right-1 -translate-y-1/2 text-xs font-semibold text-slate-400"
              style={{ top: `${level.y}%` }}
            >
              {level.count}
            </span>
          ))}
        </div>

        <div className="flex h-8 items-center justify-center bg-[#f5f7fa] text-xs font-semibold text-slate-400">管理区</div>
        <div className="flex h-8 items-center bg-[#f5f7fa] px-4 text-xs font-semibold text-slate-600">准备退出：无</div>
        <div className="bg-[#f5f7fa]" />

        <div />
        <div className="relative h-12 bg-white">
          {ASSESSMENT_RANK_BANDS.map((band) => (
            <div
              key={`axis-${band.label}`}
              className="absolute top-3 -translate-x-1/2 text-center text-[11px] font-semibold text-slate-400"
              style={{ left: `${band.x}%` }}
            >
              <p>{band.label}</p>
              <p className="mt-1">{band.caption}</p>
            </div>
          ))}
          <div className="absolute right-0 top-3 text-xs font-semibold text-slate-400">业绩排名</div>
        </div>
        <div />
      </div>
    </div>
  );
}

function AssessmentTable({
  rows,
  subs,
  selectedName,
  submittedFeedbackBySubId,
  onSelectSub,
  onOpenPerformanceDetail,
  onWriteFeedback,
}: {
  rows: AssessmentRow[];
  subs: Subordinate[];
  selectedName?: string;
  submittedFeedbackBySubId: Record<string, SubmittedFeedback>;
  onSelectSub: (sub: Subordinate) => void;
  onOpenPerformanceDetail: () => void;
  onWriteFeedback: (sub: Subordinate) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_12px_30px_rgba(31,47,71,0.04)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-4 w-1 rounded-full bg-primary" />
          <h3 className="text-sm font-black text-slate-800">下属绩效明细</h3>
        </div>
        <span className="text-xs font-semibold text-slate-400">共{rows.length}人</span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {rows.map((row, index) => {
          const sub = subs.find((item) => item.name === row.name);
          const submitted = sub ? submittedFeedbackBySubId[sub.id] : undefined;
          const active = selectedName === row.name;
          const score = submitted?.score ?? row.score;
          const comment = submitted?.highlights ?? row.comment;
          return (
            <article
              key={row.id}
              className={`rounded-2xl border bg-white p-4 shadow-[0_8px_20px_rgba(31,47,71,0.04)] transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_16px_34px_rgba(31,47,71,0.08)] ${
                active ? "border-primary bg-primary-soft/20 ring-2 ring-primary/10" : "border-slate-200"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className="relative shrink-0">
                  <img
                    src={sub ? getPersonAvatarUrl(sub.id, sub.name) : getPersonAvatarUrl(row.id, row.name)}
                    alt={row.name}
                    className="h-12 w-12 rounded-xl object-cover ring-1 ring-white"
                  />
                  <span className="absolute -left-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-slate-900 px-1 text-[10px] font-black text-white">
                    {index + 1}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => {
                      if (sub) onSelectSub(sub);
                      else onOpenPerformanceDetail();
                    }}
                    className="truncate text-base font-black text-slate-800 transition hover:text-primary"
                  >
                    {row.name}
                  </button>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-500">{row.title}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2 py-1 text-[11px] font-bold ${
                  row.status === "待反馈"
                    ? "bg-primary-soft text-primary"
                    : row.status === "已确认"
                      ? "bg-success-soft text-success"
                      : row.status === "已催办"
                        ? "bg-warning-soft text-warning"
                        : "bg-slate-100 text-slate-500"
                }`}>
                  {row.status}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-4 gap-2">
                <AssessmentCardMetric label="排名" value={row.rank} />
                <AssessmentCardMetric label="评分" value={score} />
                <AssessmentCardMetric label="趋势" value={row.trend} accent={row.trend === "↑"} />
                <AssessmentCardMetric label="管理区" value={row.managerZone} muted />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={`rounded-md px-2 py-1 text-xs font-black ${
                  row.ability === "完全胜任"
                    ? "bg-primary-soft text-primary"
                    : row.ability === "基本胜任"
                      ? "bg-warning-soft text-warning"
                      : row.ability === "超越胜任"
                        ? "bg-success-soft text-success"
                        : "bg-slate-100 text-slate-400"
                }`}>
                  {row.ability}
                </span>
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold text-slate-500">
                  {row.rankBand === "--" ? "未进入排名组" : row.rankBand}
                </span>
              </div>

              <div className="mt-3 min-h-[66px] rounded-xl bg-[#f7f9fc] px-3 py-2">
                <p className="text-[11px] font-bold text-slate-400">综合评价</p>
                <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-slate-600">{comment}</p>
              </div>

              <div className="mt-3 grid grid-cols-3 gap-2">
                <AssessmentActionButton
                  label="排名及画像"
                  onClick={() => {
                    if (sub) onSelectSub(sub);
                    else onOpenPerformanceDetail();
                  }}
                />
                <AssessmentActionButton
                  label="年度总结"
                  onClick={() => (sub ? onWriteFeedback(sub) : onOpenPerformanceDetail())}
                />
                <AssessmentActionButton
                  label="月度汇报"
                  onClick={() => (sub ? onSelectSub(sub) : onOpenPerformanceDetail())}
                />
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function AssessmentCardMetric({
  label,
  value,
  accent = false,
  muted = false,
}: {
  label: string;
  value: string | number;
  accent?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="rounded-xl bg-[#f7f9fc] px-2 py-2 text-center">
      <p className="text-[10px] font-bold text-slate-400">{label}</p>
      <p className={`mt-1 truncate text-sm font-black ${accent ? "text-[#ff5a1f]" : muted ? "text-slate-400" : "text-slate-800"}`}>
        {value}
      </p>
    </div>
  );
}

function AssessmentActionButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="min-h-9 rounded-lg border border-primary/20 bg-white px-2 text-xs font-black text-primary transition hover:bg-primary hover:text-white"
    >
      {label}
    </button>
  );
}

function OrgChartPanel({
  subs,
  selectedId,
  activeVersion,
  previewSubId,
  pendingFeedbackCount,
  notSubmittedCount,
  confirmedCount,
  pendingFeedbackSubs,
  notSubmittedSubs,
  cooldowns,
  submittedFeedbackBySubId,
  onSelect,
  onPreviewSub,
  onClosePreview,
  onWriteFeedback,
  getRemindCooldownMs,
  onRemindSub,
  onRemind,
}: {
  subs: Subordinate[];
  selectedId?: string;
  activeVersion: ManagerOrgVersion;
  previewSubId?: string | null;
  pendingFeedbackCount: number;
  notSubmittedCount: number;
  confirmedCount: number;
  pendingFeedbackSubs: Subordinate[];
  notSubmittedSubs: Subordinate[];
  cooldowns: Record<string, number>;
  submittedFeedbackBySubId: Record<string, SubmittedFeedback>;
  onSelect: (sub: Subordinate) => void;
  onPreviewSub: (sub: Subordinate) => void;
  onClosePreview: () => void;
  onWriteFeedback: (sub: Subordinate) => void;
  getRemindCooldownMs: (id: string) => number;
  onRemindSub: (sub: Subordinate) => void;
  onRemind: (ids: string[]) => void;
}) {
  const directSubs = subs.filter((s) => s.type === "direct");
  const indirectSubs = subs.filter((s) => s.type === "indirect");
  const selectedSub = subs.find((s) => s.id === selectedId);
  const [activeGroup, setActiveGroup] = useState<Subordinate["type"]>(selectedSub?.type ?? "direct");
  const [orgZoom, setOrgZoom] = useState(1.05);
  const [orgStatusFilter, setOrgStatusFilter] = useState<OrgStatusFilter>("all");
  const activeSubs = activeGroup === "direct" ? directSubs : indirectSubs;
  const filteredActiveSubs = filterAndSortOrgSubs(activeSubs, orgStatusFilter);
  const allSubs = [...directSubs, ...indirectSubs];

  useEffect(() => {
    if (!selectedSub) return;
    setActiveGroup(selectedSub.type);
  }, [selectedSub?.type]);

  return (
    <aside className={`rounded-2xl bg-card shadow-[0_18px_45px_rgba(15,23,42,0.06)] ${
      activeVersion === "v1" ? "h-[calc(100vh-20rem)] min-h-[520px] overflow-hidden" : "h-[calc(100vh-20rem)] min-h-[520px] overflow-visible"
    }`}>
      <div className={activeVersion === "v1" ? "h-full p-3" : "h-full p-4"}>
        {activeVersion === "v1" ? (
          <div className="flex h-full min-h-0 flex-col gap-2.5">
            <OrgChartControlCluster
              pendingFeedbackCount={pendingFeedbackCount}
              notSubmittedCount={notSubmittedCount}
              confirmedCount={confirmedCount}
              pendingFeedbackSubs={subs.filter((s) => s.status === "pending_feedback")}
              notSubmittedSubs={notSubmittedSubs}
              cooldowns={cooldowns}
              onRemind={onRemind}
              onLocateSub={onSelect}
              showZoomControls={false}
            />
            <OrgChartVersionOne
              activeGroup={activeGroup}
              directSubs={directSubs}
              indirectSubs={indirectSubs}
              activeSubs={filteredActiveSubs}
              selectedId={selectedId}
              zoom={1}
              statusFilter={orgStatusFilter}
              onGroupChange={setActiveGroup}
              onStatusFilterChange={setOrgStatusFilter}
              onSelect={onSelect}
            />
          </div>
        ) : (
          <OrgChartVersionTwo
            activeGroup={activeGroup}
            directSubs={directSubs}
            indirectSubs={indirectSubs}
            activeSubs={activeSubs}
            selectedId={selectedId}
            previewSubId={previewSubId}
            zoom={orgZoom}
            onGroupChange={setActiveGroup}
            onSelect={onPreviewSub}
            onClosePreview={onClosePreview}
            submittedFeedbackBySubId={submittedFeedbackBySubId}
            onWriteFeedback={onWriteFeedback}
            getRemindCooldownMs={getRemindCooldownMs}
            onRemindSub={onRemindSub}
            pendingFeedbackCount={pendingFeedbackCount}
            notSubmittedCount={notSubmittedCount}
            confirmedCount={confirmedCount}
            pendingFeedbackSubs={allSubs.filter((s) => s.status === "pending_feedback")}
            notSubmittedSubs={notSubmittedSubs}
            cooldowns={cooldowns}
            onZoomOut={() => setOrgZoom((zoom) => Math.max(0.75, Math.round((zoom - 0.05) * 100) / 100))}
            onZoomIn={() => setOrgZoom((zoom) => Math.min(1.35, Math.round((zoom + 0.05) * 100) / 100))}
            onReset={() => setOrgZoom(1)}
            onRemind={onRemind}
          />
        )}
      </div>
    </aside>
  );
}

function OrgZoomControl({
  zoom,
  onZoomOut,
  onZoomIn,
  onReset,
  compact = false,
}: {
  zoom: number;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onReset: () => void;
  compact?: boolean;
}) {
  return (
      <div className={`flex items-center ${compact ? "gap-1.5" : "gap-3"}`}>
        <div className={`grid items-center overflow-hidden rounded-full border border-slate-300 bg-white text-center text-sm font-black text-foreground shadow-[0_8px_18px_rgba(15,23,42,0.08)] ${
        compact ? "h-8 grid-cols-[30px_46px_30px]" : "h-9 grid-cols-[38px_64px_38px]"
      }`}>
        <button
          type="button"
          onClick={onZoomOut}
          className="grid h-full place-items-center transition hover:bg-secondary"
          aria-label="缩小架构图"
        >
          <Minus className="h-4 w-4" />
        </button>
        <span className="text-xs">{Math.round(zoom * 100)}%</span>
        <button
          type="button"
          onClick={onZoomIn}
          className="grid h-full place-items-center transition hover:bg-secondary"
          aria-label="放大架构图"
        >
          <Plus className="h-4 w-4" />
        </button>
      </div>
      <button
        type="button"
        onClick={onReset}
        className={`${compact ? "h-8 px-2" : "h-9 px-3"} rounded-xl border border-slate-300 bg-white text-xs font-black text-slate-700 shadow-[0_8px_18px_rgba(15,23,42,0.06)] transition hover:border-primary/40 hover:text-accent-foreground`}
      >
        重置视图
      </button>
    </div>
  );
}

function OrgChartControlCluster({
  pendingFeedbackCount,
  notSubmittedCount,
  confirmedCount,
  pendingFeedbackSubs,
  notSubmittedSubs,
  cooldowns,
  zoom,
  onZoomOut,
  onZoomIn,
  onReset,
  onRemind,
  onLocateSub,
  compact = false,
  showZoomControls = true,
}: {
  pendingFeedbackCount: number;
  notSubmittedCount: number;
  confirmedCount: number;
  pendingFeedbackSubs: Subordinate[];
  notSubmittedSubs: Subordinate[];
  cooldowns: Record<string, number>;
  zoom?: number;
  onZoomOut?: () => void;
  onZoomIn?: () => void;
  onReset?: () => void;
  onRemind: (ids: string[]) => void;
  onLocateSub: (sub: Subordinate) => void;
  compact?: boolean;
  showZoomControls?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "flex min-w-0 items-center gap-2 rounded-xl bg-white/90 px-2 py-1.5 shadow-[0_8px_20px_rgba(15,23,42,0.06)] ring-1 ring-border/70 backdrop-blur"
          : "w-full rounded-xl bg-white/92 p-2 shadow-[0_10px_24px_rgba(15,23,42,0.07)] ring-1 ring-border/80 backdrop-blur"
      }
    >
      <div className={compact ? "flex min-w-0 items-center gap-1.5" : "grid grid-cols-3 gap-1.5"}>
        <OrgStatusMetric
          label="待反馈"
          value={pendingFeedbackCount}
          tone="primary"
          compact={compact}
          valueNode={
            <OrgLocatePopover
              targets={pendingFeedbackSubs}
              emptyText="当前没有待反馈人员"
              triggerClassName={compact ? "text-base font-black leading-none text-primary transition hover:scale-105" : "mt-1 text-2xl font-black leading-none text-primary transition hover:scale-105"}
              onSelect={onLocateSub}
            />
          }
        />
        <OrgStatusMetric
          label="待提交"
          value={notSubmittedCount}
          tone="warning"
          compact={compact}
          action={
            notSubmittedCount > 0 ? (
              <RemindPopover
                targets={notSubmittedSubs}
                cooldowns={cooldowns}
                onConfirm={onRemind}
                onLocate={onLocateSub}
                triggerSize="compact"
              />
            ) : null
          }
        />
        <OrgStatusMetric label="已确认" value={confirmedCount} tone="muted" compact={compact} />
      </div>
      {showZoomControls && zoom != null && onZoomOut && onZoomIn && onReset && (
      <div className={compact ? "ml-1 flex shrink-0" : "mt-2 flex justify-end"}>
        <OrgZoomControl
          zoom={zoom}
          onZoomOut={onZoomOut}
          onZoomIn={onZoomIn}
          onReset={onReset}
          compact={compact}
        />
      </div>
      )}
    </div>
  );
}

function OrgStatusMetric({
  label,
  value,
  tone,
  action,
  valueNode,
  compact = false,
}: {
  label: string;
  value: number;
  tone: "primary" | "warning" | "muted";
  action?: React.ReactNode;
  valueNode?: React.ReactNode;
  compact?: boolean;
}) {
  const valueClass =
    tone === "warning" ? "text-warning" : tone === "muted" ? "text-slate-500" : "text-primary";
  return (
    <div
      className={
        compact
          ? "flex min-h-8 items-center gap-1.5 rounded-lg border border-border bg-white px-2 py-1 text-center shadow-[0_5px_12px_rgba(15,23,42,0.045)]"
          : "flex min-h-[52px] flex-col items-center justify-center rounded-lg border border-border bg-white px-2 py-1 text-center shadow-[0_6px_14px_rgba(15,23,42,0.045)]"
      }
    >
      <p className={compact ? "text-[11px] font-bold text-muted-foreground" : "text-[11px] font-bold text-muted-foreground"}>{label}</p>
      {valueNode ?? (
        <p className={`${compact ? "text-base" : "mt-0.5 text-xl"} font-black leading-none ${valueClass}`}>{value}</p>
      )}
      {action && <div className={compact ? "ml-0.5" : "mt-1.5"}>{action}</div>}
    </div>
  );
}

function OrgLocatePopover({
  targets,
  emptyText,
  triggerClassName,
  onSelect,
}: {
  targets: Subordinate[];
  emptyText: string;
  triggerClassName: string;
  onSelect: (sub: Subordinate) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" className={triggerClassName}>
          {targets.length}
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" sideOffset={10} className="w-80 p-3">
        <div className="mb-2">
          <p className="text-sm font-semibold">待反馈人员</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">点击人员可定位到组织卡片并打开绩效详情。</p>
        </div>
        {targets.length > 0 ? (
          <ul className="max-h-64 overflow-auto space-y-1.5 rounded-lg border border-border bg-secondary/40 p-2">
            {targets.map((sub) => (
              <li key={sub.id}>
                <button
                  type="button"
                  onClick={() => {
                    onSelect(sub);
                    setOpen(false);
                  }}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition hover:bg-white"
                >
                  <Avatar initial={sub.initial} size="sm" src={getPersonAvatarUrl(sub.id, sub.name)} alt={sub.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold text-foreground">{sub.name}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{sub.title}</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rounded-lg bg-secondary/60 px-3 py-4 text-center text-xs text-muted-foreground">
            {emptyText}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function OrgChartVersionOne({
  activeGroup,
  directSubs,
  indirectSubs,
  activeSubs,
  selectedId,
  zoom,
  statusFilter,
  onGroupChange,
  onStatusFilterChange,
  onSelect,
}: {
  activeGroup: Subordinate["type"];
  directSubs: Subordinate[];
  indirectSubs: Subordinate[];
  activeSubs: Subordinate[];
  selectedId?: string;
  zoom: number;
  statusFilter: OrgStatusFilter;
  onGroupChange: (group: Subordinate["type"]) => void;
  onStatusFilterChange: (filter: OrgStatusFilter) => void;
  onSelect: (sub: Subordinate) => void;
}) {
  return (
    <div
      className="relative min-h-[320px] flex-1 overflow-x-hidden overflow-y-auto rounded-xl bg-white px-3 pb-4 pt-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]"
      style={{
        backgroundImage:
          "linear-gradient(rgba(134,144,156,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(134,144,156,0.055) 1px, transparent 1px)",
        backgroundSize: "18px 18px",
      }}
    >
      <div className="absolute inset-x-4 bottom-4 top-[142px] rounded-xl bg-white/42 shadow-[inset_0_0_32px_rgba(134,144,156,0.08)]" />

      <div
        className="relative flex min-w-0 origin-top flex-col items-center transition-transform duration-200"
        style={{ transform: `scale(${zoom})`, width: `${100 / zoom}%` }}
      >
        <div className="mb-3 flex w-full min-w-0 items-center justify-end">
          <div className="inline-flex max-w-full overflow-hidden rounded-lg border border-border bg-white/95 p-0.5 shadow-[0_8px_18px_rgba(15,23,42,0.055)]">
            {ORG_STATUS_FILTERS.map((filter) => (
              <button
                key={filter.key}
                type="button"
                onClick={() => onStatusFilterChange(filter.key)}
                className={`h-7 whitespace-nowrap rounded-md px-2 text-[11px] font-black transition ${
                  statusFilter === filter.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:bg-primary-soft hover:text-accent-foreground"
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>
        <OrgTopNode title={CURRENT_USER.name} subtitle={CURRENT_USER.title} />
        <div className="h-8 border-l-2 border-dashed border-primary/35" />
        <div className="relative w-full">
          <div className="absolute left-1/4 right-1/4 top-0 border-t-2 border-dashed border-primary/35" />
          <div className="absolute left-1/4 top-0 h-8 border-l-2 border-dashed border-primary/35" />
          <div className="absolute right-1/4 top-0 h-8 border-l-2 border-dashed border-primary/35" />
          <div className="grid grid-cols-2 gap-3 pt-8">
            <OrgBranchNode
              title="直接下属"
              count={directSubs.length}
              active={activeGroup === "direct"}
              onClick={() => onGroupChange("direct")}
            />
            <OrgBranchNode
              title="间接下属"
              count={indirectSubs.length}
              active={activeGroup === "indirect"}
              onClick={() => onGroupChange("indirect")}
            />
          </div>
          <div className="mx-auto h-8 border-l-2 border-dashed border-primary/35" />
          <OrgPeopleList
            subs={activeSubs}
            selectedId={selectedId}
            onSelect={onSelect}
          />
        </div>
      </div>
    </div>
  );
}

const SUB_DEPARTMENT_BY_ID: Record<string, string> = {
  "1": "产险总部总经理室",
  "2": "产险总部总经理室",
  "3": "产险总部总经理室",
  "4": "产险总部总经理室",
  "5": "产险总部总经理室",
  "6": "产险总部理赔运营中心作业管理团队",
  "12": "团体事业群",
  "13": "理赔运营中心",
  "14": "科技中心团体研发团队",
  "15": "团体事业群",
  "16": "人力资源与行政服务团队",
};

function getSubDepartment(sub: Subordinate) {
  if (SUB_DEPARTMENT_BY_ID[sub.id]) return SUB_DEPARTMENT_BY_ID[sub.id];
  if (sub.title.includes("分公司") || sub.title.includes("业务负责人")) return "分公司经营管理";
  return sub.type === "direct" ? "产险总部总经理室" : "产险总部及分支管理";
}

function groupSubsByDepartment(subs: Subordinate[]) {
  return subs.reduce<Array<{ department: string; members: Subordinate[] }>>((groups, sub) => {
    const department = getSubDepartment(sub);
    const group = groups.find((item) => item.department === department);
    if (group) {
      group.members.push(sub);
    } else {
      groups.push({ department, members: [sub] });
    }
    return groups;
  }, []);
}

function filterAndSortOrgSubs(subs: Subordinate[], filter: OrgStatusFilter) {
  return subs
    .filter((sub) => {
      if (filter === "all") return true;
      if (filter === "pending_submit") return sub.status === "not_submitted" || sub.status === "reminded";
      return sub.status === filter;
    })
    .map((sub, index) => ({ sub, index }))
    .sort((a, b) => ORG_STATUS_SORT_ORDER[a.sub.status] - ORG_STATUS_SORT_ORDER[b.sub.status] || a.index - b.index)
    .map(({ sub }) => sub);
}

function getLastSupervisorScore(sub: Subordinate, submittedFeedback?: SubmittedFeedback) {
  return submittedFeedback?.score ?? (sub.score ? Math.min(100, sub.score + 1) : 83);
}

function getSupervisorAiSummary(submittedFeedback?: SubmittedFeedback) {
  if (submittedFeedback) {
    return `${submittedFeedback.highlights} ${submittedFeedback.shortcomings} ${submittedFeedback.nextFocus}`;
  }
  return "方案质量稳定，客户沟通有效；重点客户问题响应及时，关键交付物质量良好。建议继续提升方案复用沉淀，并前置暴露跨团队协同风险。";
}

const PERSONAL_SUPERVISOR_FEEDBACK = [
  {
    period: "2026-04",
    date: "2026-05-06",
    supervisor: "郭晓涛",
    score: 85,
    rating: "良好",
    highlights:
      "4 月产险 KPI 得分优异，请继续保持。对于当前工作，以下方面给予肯定：\n整体经营稳健：一季度保费增速超市场，较大幅度超人太，4 月预计保持超市场的良好态势。\n五一理赔作业部署得当有效：通过全国远程集中调度，实现五一新发结案率同比提升 7pt，新发结案时效同比优化 0.3 天。同时，聚焦全国 155 个热门景区周边道路开展风险减量，减少事故的同时持续深化警保联动，取得实效。",
    shortcomings:
      "此外，在以下方面仍需加强：\n人力优化：AI 科技发展迅猛，人力结构优化调整势在必行，产险要深入研究 AI 赋能逻辑，思考人力结构调整方向，提早准备，适配公司未来发展要求。\n个全新客达成不及预期：受市场新车负增、G 端惠民保新客下降影响，产险目前新客数 770 万，同比下降 6%，不及预期。要基于车主和非车主客户现状，制定差异化策略，弥补缺口。\n企康委托规模落后：截至 4 月底，企康委托规模达成 58 亿，目标 62 亿，落后目标。需进一步加强业务政策宣导，增加商机储备，在稳定委托基本盘的同时，在医健、急难救援方面寻求突破。",
    nextFocus:
      "5 月需要聚焦以下重点工作：\n长护险研究：落实集团战略导向，针对各地长护险市场差异大的现状，持续加强各地调研，全面掌握各地长护险市场的区域特征，规划下一步工作思路。5 月 12 日风暴讨论。\n海外业务和十五五规划布局：要结合五一期间参加美国保险峰会的情况总结，带领产险深入研究海外市场机遇，尤其对于效益持续稳定的海外业务板块、国家着力发展的中资出海板块、国家十五五规划的重点领域，针对性匹配调整核保政策，实现业务突破。下次月度绩效面谈汇报进展。\n班子分工：产险 2 位班子面临退休，要结合业务发展战略方向及产险班子特点，认真思考、提前规划，做好班子分工调整。下次月度绩效面谈汇报进展。",
  },
  {
    period: "2026-03",
    date: "2026-04-06",
    supervisor: "郭晓涛",
    score: 84,
    rating: "良好",
    highlights: "产险经营保持稳健，重点业务节奏清晰，监管沟通和风险减量工作持续推进。",
    shortcomings: "新客增长、企康委托和部分车险机构改善仍需更强穿透。",
    nextFocus: "持续推动核心业务补缺、经营风险前置识别和集团重点项目落地。",
  },
  {
    period: "2026-02",
    date: "2026-03-06",
    supervisor: "郭晓涛",
    score: 84,
    rating: "良好",
    highlights: "开年经营节奏稳定，利润、份额和成本率目标拆解较清晰，重点项目承接较快。",
    shortcomings: "企康委托、个非新客和机构差异化经营仍需更早拉通，部分重点事项闭环还不够前置。",
    nextFocus: "围绕一季度达成加强经营复盘，压实机构追赶动作，提前识别关键岗位和人力结构调整需求。",
  },
  {
    period: "2026-01",
    date: "2026-02-06",
    supervisor: "郭晓涛",
    score: 83,
    rating: "良好",
    highlights: "年度目标承接较充分，产险经营班子对重点任务形成共识，风险减量和非车策略启动顺畅。",
    shortcomings: "部分业务线目标拆解颗粒度不足，新客增长和线上渠道模式创新需要更强抓手。",
    nextFocus: "强化年度重点任务里程碑管理，推动线上线销模式复盘，并跟进非车业务增长策略。",
  },
  {
    period: "2025-12",
    date: "2026-01-06",
    supervisor: "郭晓涛",
    score: 85,
    rating: "良好",
    highlights: "年度收官整体稳健，重点经营指标韧性较强，理赔作业和风险管理机制持续优化。",
    shortcomings: "长期增长动能、客户经营和企康服务生态仍需形成更强协同，数字化工具推广不够均衡。",
    nextFocus: "做好新年度经营策略衔接，围绕客户经营、AI赋能和组织效率制定明确推进节奏。",
  },
  {
    period: "2025-11",
    date: "2025-12-06",
    supervisor: "郭晓涛",
    score: 84,
    rating: "良好",
    highlights: "重点机构经营改善有进展，风险减量和理赔效率提升动作较扎实，团队协同保持稳定。",
    shortcomings: "部分区域市场对标改善不均衡，长周期机制沉淀不足，对新客和企康缺口的穿透还需加强。",
    nextFocus: "继续压实区域经营改善，沉淀可复制打法，并提前谋划下年度重点资源配置。",
  },
];

const PERSONAL_MONTHLY_REPORTS = [
  {
    period: "2026-04",
    submittedAt: "2026-05-05 21:30",
    original:
      "4月围绕产险核心KPI和重点经营动作推进。考核利润、份额提升和COR优于市场整体保持良好节奏，五一理赔作业提前部署，新发结案率和结案时效有改善。企康、两地牌照一体化、非车发展策略等关键工作按计划推进，其中健康险、宠物险和小微综合保险保费达成较好。当前不足主要集中在人力结构优化准备、个全新客增长、企康委托规模和部分长期机制建设。下月会继续聚焦长护险研究、海外业务、十五五规划布局及班子分工调整。",
    highlights:
      "4月核心KPI整体达成良好，产险经营节奏稳健；五一理赔作业部署有效，非车重点业务和两地牌照一体化管理形成阶段进展。",
    shortcomings:
      "人力结构优化需要更早准备，个全新客同比下降不及预期，企康委托规模落后目标，部分重点工作仍需形成更清晰的长期机制。",
    nextFocus:
      "聚焦长护险研究、海外业务和十五五规划布局，提前规划产险班子分工调整，并继续推动企康、非车和压舱石提升闭环。",
  },
  {
    period: "2026-03",
    submittedAt: "2026-04-05 20:10",
    original:
      "3月产险经营整体保持稳健，核心KPI围绕利润、份额和成本率持续推进。重点工作方面，企康、健康险、车险经营和数字营销均有阶段性进展。当前需要继续强化新客增长、企康委托、车险区域改善和跨团队协同穿透。",
    highlights:
      "产险经营保持稳健，核心业务节奏清晰，监管沟通和风险减量工作持续推进。",
    shortcomings:
      "新客增长、企康委托和部分车险机构改善仍需更强穿透，部分动作闭环颗粒度不够细。",
    nextFocus:
      "持续推动核心业务补缺、经营风险前置识别和集团重点项目落地，强化月度经营复盘。",
  },
];

function getCurrentMonthPeriod() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function addMonth(period: string, delta: number) {
  const [year, month] = period.split("-").map(Number);
  const date = new Date(year, month - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getPersonalMonthlyPeriodOptions() {
  const dataPeriods = [...PERSONAL_SUPERVISOR_FEEDBACK, ...PERSONAL_MONTHLY_REPORTS].map((item) => item.period);
  const earliest = dataPeriods.sort()[0] ?? CURRENT_PERIOD;
  const current = getCurrentMonthPeriod();
  const periods: string[] = [];
  for (let period = earliest; period <= current; period = addMonth(period, 1)) {
    periods.push(period);
  }
  return periods.reverse();
}

function getPersonalFeedbackForPeriod(period: string) {
  return PERSONAL_SUPERVISOR_FEEDBACK.find((item) => item.period === period) ?? {
    period,
    date: "",
    supervisor: CURRENT_USER.supervisor,
    score: 0,
    rating: "待反馈",
    highlights: "当前月份尚未收到上级反馈。",
    shortcomings: "待主考反馈同步后展示。",
    nextFocus: "待主考反馈同步后展示。",
  };
}

function hasPersonalFeedbackForPeriod(period: string) {
  return PERSONAL_SUPERVISOR_FEEDBACK.some((item) => item.period === period);
}

function getPersonalMonthlyReportForPeriod(period: string) {
  return PERSONAL_MONTHLY_REPORTS.find((item) => item.period === period) ?? {
    period,
    submittedAt: "",
    original: "当前月份尚未提交月度汇报。",
    highlights: "待提交后展示本期工作亮点。",
    shortcomings: "待提交后展示本期不足。",
    nextFocus: "待提交后展示下月重点。",
  };
}

function hasPersonalMonthlyReportForPeriod(period: string) {
  return PERSONAL_MONTHLY_REPORTS.some((item) => item.period === period);
}

function getSubMonthlyPeriodOptions() {
  const current = getCurrentMonthPeriod();
  const earliest = "2025-11";
  const periods: string[] = [];
  for (let period = earliest; period <= current; period = addMonth(period, 1)) {
    periods.push(period);
  }
  return periods.reverse();
}

function hasSubFeedbackForPeriod(sub: Subordinate, period: string, submittedFeedback?: SubmittedFeedback) {
  if (submittedFeedback?.period === period) return true;
  if (period === CURRENT_PERIOD) return sub.status === "confirmed";
  return period === "2026-03" || period === "2026-02";
}

function getSubFeedbackForPeriod(sub: Subordinate, period: string, submittedFeedback?: SubmittedFeedback): SubmittedFeedback {
  if (submittedFeedback?.period === period) return submittedFeedback;
  if (period === CURRENT_PERIOD) {
    return {
      period,
      submittedAt: "",
      score: sub.score ? Math.min(100, sub.score + 1) : 83,
      highlights: "个非健康险创新取得进展；智小安AI工具得到监管及行业认可。",
      shortcomings: "车险及个非发展均存在一定问题，个全新客数达成不及预期，平台和线销模式变革较慢。",
      nextFocus: "确保车险及个非半年超市场，推进集团重点项目、HS模式突破和AI组织相关工作。",
    };
  }
  return {
    period,
    submittedAt: `${period}-28T18:00:00.000Z`,
    score: Math.max(78, Math.min(95, (sub.score ?? 84) - (period === "2026-03" ? 1 : 2))),
    highlights: "阶段性经营动作有推进，重点任务基本按节奏完成，跨团队协同保持稳定。",
    shortcomings: "部分指标改善仍不均衡，过程复盘和长期机制沉淀需要继续加强。",
    nextFocus: "继续压实经营改善动作，聚焦关键缺口补强，并按月形成闭环复盘。",
  };
}

function hasSubMonthlyReportForPeriod(sub: Subordinate, period: string) {
  if (sub.status === "not_submitted" || sub.status === "reminded") return false;
  return period === CURRENT_PERIOD || period === "2026-03" || period === "2026-02";
}

function getSubMonthlyReportForPeriod(period: string): SubMonthlyReportRecord {
  if (period === CURRENT_PERIOD) {
    return {
      period,
      original:
        "1、上月不足的改善：车险年累计落后市场缺口缩小，小个非4月当月对标市场有改善，集团个金标签及策略上线，AI应用培训已覆盖200余人。2、本月重点工作进展：开展个人事业群全国会与基层干部宣导，推进车险经营及问题机构帮扶，HS项目进展符合预期，梳理互联网车险模式，并推动AI组织升级。3、本月存在的不足：个旧提升对标人保仍有差距，HS合作主体集中度高，众安数基拿回仍需跟进用足，个非新口径累计落后市场，K6组织相关工作需加快。",
      highlights: "车险、小个非、集团个金和AI应用均围绕上月不足形成改善动作；个人事业群全国会、HS项目、互联网车险模式和AI组织升级按计划推进。",
      shortcomings: "个旧提升对标人保仍有差距，HS合作主体集中度高，个非新口径累计仍落后市场，K6组织相关工作需要加快。",
      nextFocus: "确保车险及个非半年超市场，推进医疗险理赔、粤港跨境车险、信用卡权益和生命尊享托管等集团重点项目，并加强HS监管沟通、AI工具推广与K6组织转型。",
    };
  }
  return {
    period,
    original: `${Number(period.split("-")[1])}月围绕个人客户经营、健康险、企康和数字营销推进，核心任务整体按计划完成，部分增长指标仍需加强过程穿透。`,
    highlights: "重点项目按月推进，经营动作和协同机制保持稳定，部分业务线形成阶段成果。",
    shortcomings: "新客增长、区域改善和部分平台化动作仍需强化闭环。",
    nextFocus: "下月继续聚焦核心缺口补强、重点项目里程碑和跨团队协同效率。",
  };
}

function PersonalPerformanceOverview() {
  const [feedbackPeriod, setFeedbackPeriod] = useState(PERSONAL_SUPERVISOR_FEEDBACK[0].period);
  const activeFeedback =
    PERSONAL_SUPERVISOR_FEEDBACK.find((item) => item.period === feedbackPeriod) ?? PERSONAL_SUPERVISOR_FEEDBACK[0];

  return (
    <section className="rounded-2xl border border-border bg-white p-4 shadow-[0_14px_34px_rgba(26,39,63,0.06)]">
      <div className="grid min-w-0 items-stretch gap-3 xl:h-[360px] xl:grid-cols-[minmax(250px,1fr)_minmax(360px,1.48fr)_minmax(300px,1fr)]">
        <PerformanceListBlock
          icon={<Target className="h-4 w-4 text-primary" />}
          title="核心 KPI"
          count={`${PERSONAL_KPIS.length} 项`}
          items={PERSONAL_KPIS.map((item) => ({
            label: item.title,
            meta: item.weight,
            detail: item.goal,
          }))}
        />
        <PerformanceListBlock
          icon={<BriefcaseBusiness className="h-4 w-4 text-success" />}
          title="关键工作"
          count={`${PERSONAL_KEY_WORK.length} 项`}
          tone="green"
          items={getPrioritizedPersonalKeyWork().map((item) => ({
            label: item.title,
            meta: "目标",
            detail: item.goal,
          }))}
        />
        <div className="flex h-full min-h-0 flex-col rounded-xl border border-primary/15 bg-primary-soft/20 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="grid h-7 w-7 place-items-center rounded-lg bg-white text-primary shadow-sm">
                <MessageCircle className="h-3.5 w-3.5" />
              </div>
              <div>
                <p className="text-sm font-black text-foreground">上级反馈</p>
              </div>
            </div>
            <select
              value={feedbackPeriod}
              onChange={(event) => setFeedbackPeriod(event.target.value)}
              className="h-7 rounded-md border border-border bg-white px-2 text-xs font-semibold text-foreground"
              aria-label="选择上级反馈周期"
            >
              {PERSONAL_SUPERVISOR_FEEDBACK.map((item, index) => (
                <option key={item.period} value={item.period}>
                  {item.period}{index === 0 ? "（最新）" : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="mt-2 flex items-center gap-2.5 border-b border-primary/10 pb-2">
            <strong className="text-2xl leading-none text-primary">{activeFeedback.score}</strong>
          </div>
          <div className="mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
            <FeedbackCompactLine label="亮点" text={activeFeedback.highlights} tone="success" />
            <FeedbackCompactLine label="不足" text={activeFeedback.shortcomings} tone="warning" />
            <FeedbackCompactLine label="下月重点" text={activeFeedback.nextFocus} tone="primary" />
          </div>
        </div>
      </div>
    </section>
  );
}

function PerformanceListBlock({
  icon,
  title,
  count,
  items,
  tone = "blue",
  height,
}: {
  icon: React.ReactNode;
  title: string;
  count: string;
  items: Array<{ label: string; meta: string; detail: string }>;
  tone?: "blue" | "green";
  height?: number | null;
}) {
  const badgeClass = tone === "green" ? "bg-success-soft text-success" : "bg-primary-soft text-accent-foreground";
  return (
    <div
      className="flex h-full min-h-0 flex-col rounded-xl border border-border bg-white p-3 shadow-[0_8px_22px_rgba(26,39,63,0.04)]"
      style={height ? { height: `${height}px` } : undefined}
    >
      <div className="mb-2 flex items-center gap-2">
        <div className={`grid h-7 w-7 place-items-center rounded-lg ${badgeClass}`}>{icon}</div>
        <p className="text-sm font-black text-foreground">{title}</p>
        <span className="ml-auto rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold text-muted-foreground">{count}</span>
      </div>
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1 [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
        {items.map((item) => (
          <PerformanceListItem key={item.label} item={item} />
        ))}
      </div>
    </div>
  );
}

function getPrioritizedPersonalKeyWork() {
  const priority = [
    "车险两地牌照一体化管理",
    "非车发展策略",
    "车险HS发展策略",
    "压舱石提升",
  ];
  return [...PERSONAL_KEY_WORK].sort((a, b) => {
    const ai = priority.indexOf(a.title);
    const bi = priority.indexOf(b.title);
    if (ai === -1 && bi === -1) return 0;
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

function PerformanceListItem({ item }: { item: { label: string; meta: string; detail: string } }) {
  const [expanded, setExpanded] = useState(false);
  const canToggle = item.label.length > 14 || item.detail.length > 34;

  return (
    <div className="rounded-lg bg-secondary/38 px-3 py-1.5">
      <div className="flex items-start justify-between gap-2">
        <p className={`text-xs font-black text-foreground ${expanded ? "leading-relaxed" : "truncate"}`}>{item.label}</p>
        <div className="flex shrink-0 items-center gap-1">
          {item.meta !== "目标" && (
            <span className="text-[10px] font-semibold text-muted-foreground">{item.meta}</span>
          )}
          {canToggle && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="grid h-5 w-5 place-items-center rounded-full text-muted-foreground transition hover:bg-white hover:text-primary"
              aria-label={expanded ? "收起内容" : "展开内容"}
            >
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
      </div>
      <p className={`mt-0.5 text-[11px] leading-relaxed text-muted-foreground ${canToggle && !expanded ? "line-clamp-1" : ""}`}>
        目标：{item.detail}
      </p>
    </div>
  );
}

function FeedbackCompactLine({ label, text, tone }: { label: string; text: string; tone: "success" | "warning" | "primary" }) {
  const [expanded, setExpanded] = useState(false);
  const canToggle = text.length > 54 || text.includes("\n");
  const toneClass =
    tone === "success"
      ? "bg-success-soft text-success"
      : tone === "warning"
        ? "bg-warning-soft text-warning"
        : "bg-white text-accent-foreground";
  return (
    <div className="grid grid-cols-[50px_minmax(0,1fr)] gap-1.5 rounded-lg bg-white/78 px-2 py-1.5">
      <span className={`h-5 rounded-md px-1.5 text-center text-[10px] font-bold leading-5 ${toneClass}`}>{label}</span>
      <div className="min-w-0">
        <p className={`whitespace-pre-line text-[11px] leading-relaxed text-slate-700 ${canToggle && !expanded ? "line-clamp-2" : ""}`}>
          {text}
        </p>
        {canToggle && (
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] font-bold text-primary hover:text-primary/80"
          >
            {expanded ? "收起" : "展开"}
            <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>
    </div>
  );
}

function PersonalPerformanceDrawer({
  focusMetricsSignal,
  side = "left",
  onClose,
}: {
  focusMetricsSignal?: number;
  side?: "left" | "right";
  onClose: () => void;
}) {
  const [period, setPeriod] = useState(PERSONAL_SUPERVISOR_FEEDBACK[0].period);
  const scrollBodyRef = useRef<HTMLDivElement | null>(null);
  const metricsRef = useRef<HTMLDivElement | null>(null);
  const feedback =
    getPersonalFeedbackForPeriod(period);
  const report =
    getPersonalMonthlyReportForPeriod(period);
  const periodOptions = getPersonalMonthlyPeriodOptions();

  useEffect(() => {
    if (!focusMetricsSignal) return;
    const scrollToMetrics = () => {
      const scroller = scrollBodyRef.current;
      const target = metricsRef.current;
      if (!scroller || !target) return;
      const scrollerRect = scroller.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      scroller.scrollTo({
        top: scroller.scrollTop + targetRect.top - scrollerRect.top - 12,
        behavior: "auto",
      });
    };
    const timers = [80, 180, 360, 620].map((delay) => window.setTimeout(scrollToMetrics, delay));
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [focusMetricsSignal]);

  return (
    <section
      className={`fixed bottom-6 top-20 z-50 w-[560px] min-w-[460px] max-w-[calc(100vw-3rem)] resize-x overflow-hidden rounded-2xl border border-primary/20 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.16)] duration-300 ${
        side === "right" ? "right-6 animate-in slide-in-from-right-8" : "left-6 animate-in slide-in-from-left-8"
      }`}
      aria-label="个人绩效详情"
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-white/90 text-muted-foreground shadow-sm transition hover:bg-primary-soft hover:text-accent-foreground"
        aria-label="关闭个人绩效详情"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex h-full min-h-0 flex-col">
        <div className="border-b border-border bg-secondary/30 px-5 py-4">
          <div className="flex items-start gap-4 pr-10">
            <Avatar initial={CURRENT_USER.initial} size="lg" src={MANAGER_AVATAR_URL} alt={CURRENT_USER.name} />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-semibold">{CURRENT_USER.name}</h2>
                <span className="rounded-md border border-border bg-white px-2 py-0.5 text-xs text-muted-foreground">个人绩效</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{CURRENT_USER.title}</p>
            </div>
          </div>

          <div className="mt-4 flex justify-end">
            <select
              value={period}
              onChange={(event) => setPeriod(event.target.value)}
              className="h-9 rounded-lg border border-border bg-white px-3 text-xs font-bold text-foreground shadow-sm"
              aria-label="选择个人绩效月份"
            >
              {periodOptions.map((item, index) => (
                <option key={item} value={item}>
                  {item}{index === 0 ? "（最新）" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="border-b border-border bg-white px-5">
          <div className="flex h-12 items-end gap-6">
            <button type="button" className="relative h-12 px-1 text-sm font-semibold text-foreground">
              反馈
              <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary" />
            </button>
          </div>
        </div>

        <div ref={scrollBodyRef} className="flex-1 space-y-4 overflow-y-auto bg-white p-5">
          <PersonalSupervisorFeedbackCard feedback={feedback} collapseSignal={focusMetricsSignal} />
          <PersonalMonthlyReportCard
            report={report}
            focusMetricsSignal={focusMetricsSignal}
            metricsRef={metricsRef}
          />
        </div>
      </div>
    </section>
  );
}

function PersonalSupervisorFeedbackCard({
  feedback,
  collapseSignal = 0,
  hasFeedback = true,
}: {
  feedback: (typeof PERSONAL_SUPERVISOR_FEEDBACK)[number];
  collapseSignal?: number;
  hasFeedback?: boolean;
}) {
  const [open, setOpen] = useState(true);

  useEffect(() => {
    if (!collapseSignal) return;
    setOpen(false);
  }, [collapseSignal]);

  return (
    <section className="relative overflow-hidden rounded-2xl bg-[linear-gradient(110deg,#ffffff_0%,var(--secondary)_58%,#ffffff_100%)] shadow-[0_18px_42px_rgba(15,23,42,0.07)] ring-1 ring-border/80">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative z-10 flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-white/35"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/75 text-xs font-bold text-accent-foreground shadow-inner ring-1 ring-primary-soft">
          上级
        </span>
        <span className="text-base font-semibold">上级反馈</span>
        <span className="rounded-full bg-white/75 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{feedback.period}</span>
        <ChevronDown className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && (
        <div className="relative z-10 px-5 pb-5">
          {hasFeedback ? (
            <div className="grid grid-cols-1 gap-0 overflow-hidden rounded-2xl border border-white/75 bg-white/72 shadow-[0_12px_28px_rgba(15,23,42,0.05)] backdrop-blur-md lg:grid-cols-[96px_minmax(0,1fr)]">
              <FeedbackMetric label="评分" value={`${feedback.score}分`} muted={feedback.rating} />
              <div className="grid divide-y divide-primary-soft/70">
                <FeedbackMetric label="工作亮点" value={feedback.highlights} color="success" />
                <FeedbackMetric label="存在不足" value={feedback.shortcomings} color="warning" />
                <FeedbackMetric label="下月重点" value={feedback.nextFocus} color="primary" />
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-primary/20 bg-white/72 px-4 py-8 text-center shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
              <p className="text-sm font-black text-foreground">暂无上级反馈</p>
              <p className="mt-2 text-xs font-semibold text-muted-foreground">主考完成反馈后将在这里同步展示。</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function PersonalSupervisorAiSummaryCard() {
  const recentFeedback = PERSONAL_SUPERVISOR_FEEDBACK.slice(0, 6);
  const avgScore = Math.round(recentFeedback.reduce((sum, item) => sum + item.score, 0) / recentFeedback.length);
  const periods = `${recentFeedback[recentFeedback.length - 1].period} 至 ${recentFeedback[0].period}`;

  return (
    <section className="rounded-2xl border border-primary/15 bg-[linear-gradient(135deg,#f8fbff_0%,#ffffff_62%,#f7fbf9_100%)] p-5 shadow-[0_16px_36px_rgba(15,23,42,0.055)]">
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary-soft text-primary shadow-inner ring-1 ring-primary/10">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-base font-semibold text-foreground">AI摘要</p>
            <p className="mt-1 text-xs font-medium text-muted-foreground">基于近6月上级反馈提炼 · {periods}</p>
          </div>
        </div>
        <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-primary shadow-sm ring-1 ring-primary/10">
          均分 {avgScore}
        </span>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <AiSummaryPoint
          label="稳定优势"
          text="经营盘面总体稳健，利润、份额、成本率和理赔作业质量持续获得正向反馈，风险减量与重点项目承接能力较强。"
        />
        <AiSummaryPoint
          label="持续短板"
          text="新客增长、企康委托、个非追赶和区域经营改善反复出现，说明增长抓手和机构穿透仍需更清晰的闭环机制。"
        />
        <AiSummaryPoint
          label="下阶段重心"
          text="建议把长护险、海外业务、十五五规划、AI赋能和班子分工纳入同一经营节奏，按月复盘关键里程碑和资源配置。"
        />
      </div>
    </section>
  );
}

function AiSummaryPoint({ label, text }: { label: string; text: string }) {
  return (
    <div className="rounded-xl bg-white/80 p-3 shadow-[0_8px_20px_rgba(15,23,42,0.035)] ring-1 ring-border/70">
      <p className="text-xs font-black text-primary">{label}</p>
      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{text}</p>
    </div>
  );
}

function PersonalMonthlyReportCard({
  report,
  showGoalPreview = false,
  focusMetricsSignal = 0,
  metricsRef,
  hasReport = true,
  kpiItems = PERSONAL_KPIS,
  keyWorkItems = PERSONAL_KEY_WORK,
}: {
  report: PersonalMonthlyReportRecord;
  showGoalPreview?: boolean;
  focusMetricsSignal?: number;
  metricsRef?: React.RefObject<HTMLDivElement | null>;
  hasReport?: boolean;
  kpiItems?: MonthlyMetricItem[];
  keyWorkItems?: MonthlyMetricItem[];
}) {
  const [open, setOpen] = useState(true);
  const [showOriginalReport, setShowOriginalReport] = useState(false);
  const monthLabel = `${Number(report.period.split("-")[1] ?? 0)}月月度汇报`;

  useEffect(() => {
    if (!focusMetricsSignal) return;
    setOpen(true);
  }, [focusMetricsSignal]);

  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-[0_16px_36px_rgba(15,23,42,0.06)] ring-1 ring-border/80">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-5 py-4 text-left transition hover:bg-secondary/45"
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary-soft text-xs font-bold text-accent-foreground shadow-inner">
          月报
        </span>
        <span className="text-sm font-semibold">{monthLabel}</span>
        <span className="text-[11px] text-muted-foreground">{report.period}</span>
        <ChevronDown className={`ml-auto h-4 w-4 text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>

      {open && (
        <div className="space-y-4 px-5 pb-5">
          {hasReport && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm font-bold">综合汇报</span>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{report.period}</span>
              <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">AI 整理</span>
              <button
                type="button"
                onClick={() => setShowOriginalReport((v) => !v)}
                className="ml-auto rounded-lg border border-primary/25 bg-white px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-primary-soft"
              >
                {showOriginalReport ? "查看 AI 整理" : "查看原文"}
              </button>
            </div>
            <div className="rounded-2xl bg-secondary/30 px-4 py-3.5 shadow-[0_8px_18px_rgba(15,23,42,0.035)]">
              {showOriginalReport ? (
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{report.original}</p>
              ) : (
                <div className="space-y-2 text-sm leading-relaxed text-foreground">
                  <p><span className="font-semibold text-success">亮点：</span>{report.highlights}</p>
                  <p><span className="font-semibold text-warning">不足：</span>{report.shortcomings}</p>
                  <p><span className="font-semibold text-primary">下月计划：</span>{report.nextFocus}</p>
                </div>
              )}
            </div>
          </div>
          )}

          <div ref={metricsRef} className="scroll-mt-4 space-y-4">
            <MonthlyMetricGroup title="核心 KPI" count={kpiItems.length} items={kpiItems} kind="kpi" showGoalPreview={showGoalPreview || !hasReport} showScores={hasReport} showSelfReview={hasReport} />
            <MonthlyMetricGroup title="关键工作" count={keyWorkItems.length} items={keyWorkItems} kind="work" showGoalPreview={showGoalPreview || !hasReport} showScores={hasReport} showSelfReview={hasReport} />
          </div>
        </div>
      )}
    </section>
  );
}

function OrgChartVersionTwo({
  activeGroup,
  directSubs,
  indirectSubs,
  activeSubs,
  selectedId,
  previewSubId,
  zoom,
  onGroupChange,
  onSelect,
  onClosePreview,
  submittedFeedbackBySubId,
  onWriteFeedback,
  getRemindCooldownMs,
  onRemindSub,
  pendingFeedbackCount,
  notSubmittedCount,
  confirmedCount,
  pendingFeedbackSubs,
  notSubmittedSubs,
  cooldowns,
  onZoomOut,
  onZoomIn,
  onReset,
  onRemind,
}: {
  activeGroup: Subordinate["type"];
  directSubs: Subordinate[];
  indirectSubs: Subordinate[];
  activeSubs: Subordinate[];
  selectedId?: string;
  previewSubId?: string | null;
  zoom: number;
  onGroupChange: (group: Subordinate["type"]) => void;
  onSelect: (sub: Subordinate) => void;
  onClosePreview: () => void;
  submittedFeedbackBySubId: Record<string, SubmittedFeedback>;
  onWriteFeedback: (sub: Subordinate) => void;
  getRemindCooldownMs: (id: string) => number;
  onRemindSub: (sub: Subordinate) => void;
  pendingFeedbackCount: number;
  notSubmittedCount: number;
  confirmedCount: number;
  pendingFeedbackSubs: Subordinate[];
  notSubmittedSubs: Subordinate[];
  cooldowns: Record<string, number>;
  onZoomOut: () => void;
  onZoomIn: () => void;
  onReset: () => void;
  onRemind: (ids: string[]) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<Subordinate["type"], boolean>>({
    direct: false,
    indirect: true,
  });
  const [managerPreviewOpen, setManagerPreviewOpen] = useState(false);
  const [managerPanelExpanded, setManagerPanelExpanded] = useState(false);
  const allSubs = [...directSubs, ...indirectSubs];
  const previewIndex = allSubs.findIndex((sub) => sub.id === previewSubId);
  const previewSub = previewIndex >= 0 ? allSubs[previewIndex] : undefined;
  const [slideDirection, setSlideDirection] = useState<"left" | "right">("right");
  const performanceRate = Math.round((allSubs.filter((sub) => (sub.score ?? 0) >= 80).length / allSubs.length) * 100);
  const excellentCount = allSubs.filter((sub) => (sub.score ?? 0) >= 88).length;
  const directRowWidth = Math.max(0, directSubs.length * 180 + Math.max(0, directSubs.length - 1) * 18);
  const indirectRowWidth = Math.max(0, indirectSubs.length * 180 + Math.max(0, indirectSubs.length - 1) * 18 + 210);
  const orgTrackWidth = Math.max(1120, directRowWidth, indirectRowWidth);

  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    scrollEl.scrollLeft = Math.max(0, (scrollEl.scrollWidth - scrollEl.clientWidth) / 2);
  }, [orgTrackWidth, zoom]);

  const centerOrgChart = () => {
    window.requestAnimationFrame(() => {
      const scrollEl = scrollRef.current;
      if (!scrollEl) return;
      scrollEl.scrollTo({
        left: Math.max(0, (scrollEl.scrollWidth - scrollEl.clientWidth) / 2),
        behavior: "smooth",
      });
    });
  };

  const selectWithDirection = (sub: Subordinate) => {
    const nextIndex = allSubs.findIndex((item) => item.id === sub.id);
    setSlideDirection(previewIndex === -1 || nextIndex >= previewIndex ? "right" : "left");
    setManagerPreviewOpen(false);
    onSelect(sub);
  };

  const openManagerPreview = () => {
    onClosePreview();
    setManagerPreviewOpen(true);
    setManagerPanelExpanded(false);
  };

  const navigatePreview = (step: -1 | 1) => {
    if (!allSubs.length) return;
    const currentIndex = previewIndex >= 0 ? previewIndex : 0;
    const nextIndex = (currentIndex + step + allSubs.length) % allSubs.length;
    setSlideDirection(step > 0 ? "right" : "left");
    onSelect(allSubs[nextIndex]);
  };

  const scrollOrg = (direction: -1 | 1) => {
    scrollRef.current?.scrollBy({ left: direction * 520, behavior: "smooth" });
  };

  const focusSubFromTeamAnalysis = (sub: Subordinate) => {
    setCollapsedGroups((prev) => ({ ...prev, [sub.type]: false }));
    onGroupChange(sub.type);
    selectWithDirection(sub);
    window.setTimeout(() => {
      const card = scrollRef.current?.querySelector(`[data-org-person-id="${sub.id}"]`) as HTMLElement | null;
      const container = scrollRef.current;
      if (card && container) {
        const cardRect = card.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        container.scrollBy({
          left: cardRect.left - containerRect.left - containerRect.width / 2 + cardRect.width / 2,
          behavior: "smooth",
        });
      }
      card?.focus({ preventScroll: true });
    }, 80);
  };

  const toggleGroup = (group: Subordinate["type"]) => {
    onGroupChange(group);
    setCollapsedGroups((prev) => ({ ...prev, [group]: !prev[group] }));
  };

  const resetOrgView = () => {
    onReset();
    onGroupChange("direct");
    setCollapsedGroups({ direct: false, indirect: true });
    centerOrgChart();
  };

  return (
    <div
      className="relative h-full overflow-hidden rounded-xl border border-border bg-white px-5 py-5 shadow-[0_18px_42px_rgba(26,39,63,0.08)]"
      onClick={(event) => {
        if (!previewSub && !managerPreviewOpen) return;
        const target = event.target as HTMLElement;
        if (target.closest("[data-sub-detail-card]") || target.closest("button")) return;
        setManagerPreviewOpen(false);
        onClosePreview();
      }}
    >
      <div className="relative z-10 flex h-full min-h-0 flex-col gap-4">
        <div className="flex min-h-9 min-w-0 items-center gap-3">
          <div className="flex items-center gap-2 text-sm font-black text-foreground">
            <span className="h-2 w-2 rounded-full bg-success" />
            我的团队
          </div>
          <OrgChartControlCluster
            pendingFeedbackCount={pendingFeedbackCount}
            notSubmittedCount={notSubmittedCount}
            confirmedCount={confirmedCount}
            pendingFeedbackSubs={pendingFeedbackSubs}
            notSubmittedSubs={notSubmittedSubs}
            cooldowns={cooldowns}
            zoom={zoom}
            onZoomOut={onZoomOut}
            onZoomIn={onZoomIn}
            onReset={resetOrgView}
            onRemind={onRemind}
            onLocateSub={focusSubFromTeamAnalysis}
            compact
          />
        </div>

        {previewSub && (
          <SubordinatePerformanceDrawerCard
            key={`${previewSub.id}-${slideDirection}`}
            sub={previewSub}
            submittedFeedback={submittedFeedbackBySubId[previewSub.id]}
            onClose={onClosePreview}
            onWriteFeedback={() => onWriteFeedback(previewSub)}
            onRemind={() => onRemindSub(previewSub)}
            remindCooldownMs={getRemindCooldownMs(previewSub.id)}
            currentIndex={previewIndex + 1}
            totalCount={allSubs.length}
            slideDirection={slideDirection}
            onPrev={() => navigatePreview(-1)}
            onNext={() => navigatePreview(1)}
          />
        )}

        {managerPreviewOpen && (
          <ManagerPerformanceDrawerCard
            expanded={managerPanelExpanded}
            onToggleExpanded={() => setManagerPanelExpanded((value) => !value)}
            onClose={() => setManagerPreviewOpen(false)}
          />
        )}

        <section className="relative min-h-0 flex-1 overflow-hidden">
          <button
            type="button"
            onClick={() => scrollOrg(-1)}
            className="absolute left-3 top-[315px] z-20 grid h-[78px] w-10 place-items-center rounded-full border border-slate-300 bg-white/95 text-primary shadow-[0_12px_28px_rgba(31,47,71,0.12)] transition hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-[0_16px_34px_rgba(36,87,214,0.18)]"
            aria-label="向左查看组织架构"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => scrollOrg(1)}
            className="absolute right-3 top-[315px] z-20 grid h-[78px] w-10 place-items-center rounded-full border border-slate-300 bg-white/95 text-primary shadow-[0_12px_28px_rgba(31,47,71,0.12)] transition hover:-translate-y-0.5 hover:border-primary/45 hover:shadow-[0_16px_34px_rgba(36,87,214,0.18)]"
            aria-label="向右查看组织架构"
          >
            <ChevronRight className="h-5 w-5" />
          </button>

          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-white/95 to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-white/95 to-transparent" />

          <div
            ref={scrollRef}
            className="h-full min-h-0 overflow-x-auto overflow-y-hidden px-12 pb-4 [scrollbar-color:#b8c6db_#eef3fa] [scrollbar-width:thin]"
            tabIndex={0}
            aria-label="组织架构横向滑动区域"
          >
            <div
              className="mx-auto origin-top transition-transform duration-200 px-1 pb-1"
              style={{ transform: `scale(${zoom})`, width: `${orgTrackWidth}px` }}
            >
              <OrgWorkbenchLeaderNode selected={managerPreviewOpen} onSelect={openManagerPreview} />
              <div className="mx-auto h-[42px] w-px bg-slate-400" />
              <div className="relative pt-[30px] before:absolute before:left-[10%] before:right-[10%] before:top-0 before:h-[31px] before:border-x before:border-t before:border-slate-400">
                <OrgWorkbenchBranch
                  label={`直接下属（${directSubs.length}人）`}
                  group="direct"
                  subs={directSubs}
                  selectedId={selectedId}
                  previewSubId={previewSubId}
                  submittedFeedbackBySubId={submittedFeedbackBySubId}
                  onSelect={selectWithDirection}
                  collapsed={collapsedGroups.direct}
                  onToggle={() => toggleGroup("direct")}
                />
                <OrgWorkbenchBranch
                  label={`间接下属（${indirectSubs.length}人）`}
                  group="indirect"
                  subs={indirectSubs}
                  selectedId={selectedId}
                  previewSubId={previewSubId}
                  submittedFeedbackBySubId={submittedFeedbackBySubId}
                  onSelect={selectWithDirection}
                  collapsed={collapsedGroups.indirect}
                  onToggle={() => toggleGroup("indirect")}
                  compact
                />
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}

function OrgWorkbenchLeaderNode({
  selected = false,
  onSelect,
}: {
  selected?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative z-[2] mx-auto mt-1 grid min-h-[82px] w-[246px] grid-cols-[54px_1fr] items-center gap-3 rounded-lg border bg-white/95 p-3 text-left shadow-[0_10px_24px_rgba(26,39,63,0.06)] transition hover:-translate-y-0.5 hover:border-primary/40 ${
        selected ? "border-primary shadow-[0_12px_28px_rgba(36,87,214,0.16)] outline outline-2 outline-primary/10" : "border-border"
      }`}
      aria-label="打开龙泉绩效详情"
    >
      <img
        src={MANAGER_AVATAR_URL}
        alt={CURRENT_USER.name}
        className="h-[54px] w-[54px] rounded-full object-cover shadow-[0_8px_18px_rgba(17,24,39,0.14)] ring-2 ring-white"
      />
      <div>
        <strong className="block text-[15px] leading-5 text-foreground">{CURRENT_USER.name}</strong>
        <span className="block text-xs leading-[18px] text-muted-foreground">{CURRENT_USER.company} · 董事长兼CEO</span>
      </div>
    </button>
  );
}

function OrgWorkbenchBranch({
  label,
  group,
  subs,
  selectedId,
  previewSubId,
  submittedFeedbackBySubId,
  onSelect,
  collapsed,
  onToggle,
  compact = false,
}: {
  label: string;
  group: Subordinate["type"];
  subs: Subordinate[];
  selectedId?: string;
  previewSubId?: string | null;
  submittedFeedbackBySubId: Record<string, SubmittedFeedback>;
  onSelect: (sub: Subordinate) => void;
  collapsed: boolean;
  onToggle: () => void;
  compact?: boolean;
}) {
  return (
    <div className="mb-6 flex flex-col items-center">
      <button
        type="button"
        onClick={onToggle}
        className="mb-3 ml-0.5 inline-flex items-center gap-2 rounded-lg px-1 py-1 text-[13px] font-black text-slate-700 transition hover:bg-secondary/70 hover:text-accent-foreground"
        aria-expanded={!collapsed}
        aria-controls={`org-${group}-row`}
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        <span>{label}</span>
      </button>
      {!collapsed && (
        <div
          id={`org-${group}-row`}
          className={`relative mx-auto grid w-max justify-center gap-[18px] before:pointer-events-none before:absolute before:left-[9%] before:right-[9%] before:top-[-17px] before:h-[17px] before:border-x before:border-t before:border-slate-400 ${compact ? "pr-[210px]" : ""}`}
          style={{ gridTemplateColumns: `repeat(${subs.length}, 180px)` }}
        >
          {subs.map((sub) => (
            <OrgWorkbenchPersonCard
              key={sub.id}
              sub={sub}
              selected={selectedId === sub.id || previewSubId === sub.id}
              submittedFeedback={submittedFeedbackBySubId[sub.id]}
              onSelect={() => onSelect(sub)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function OrgWorkbenchPersonCard({
  sub,
  selected,
  submittedFeedback,
  onSelect,
}: {
  sub: Subordinate;
  selected: boolean;
  submittedFeedback?: SubmittedFeedback;
  onSelect: () => void;
}) {
  const score = getLastSupervisorScore(sub, submittedFeedback);
  const keywords = getSubKeywords(sub, submittedFeedback);

  return (
    <button
      type="button"
      onClick={onSelect}
      data-org-person-id={sub.id}
      className={`relative grid min-h-[164px] content-start gap-2.5 rounded-lg border bg-white/95 p-3 text-left shadow-[0_10px_24px_rgba(26,39,63,0.06)] transition hover:-translate-y-0.5 hover:border-primary/40 ${
        selected ? "border-primary shadow-[0_12px_28px_rgba(36,87,214,0.16)] outline outline-2 outline-primary/10" : "border-border"
      } before:absolute before:left-1/2 before:top-[-17px] before:h-[17px] before:border-l before:border-slate-400`}
      title={`${sub.name} · ${sub.title}`}
    >
      <div className="grid min-h-[52px] grid-cols-[46px_minmax(0,1fr)] items-start gap-2.5">
        <img
          src={getPersonAvatarUrl(sub.id, sub.name)}
          alt={sub.name}
          className="h-[46px] w-[46px] rounded-full object-cover shadow-[0_8px_18px_rgba(17,24,39,0.14)] ring-2 ring-white"
        />
        <div className="min-w-0">
          <strong className="block truncate pr-6 text-sm leading-5 text-foreground">{sub.name}</strong>
        </div>
      </div>
      <div className="grid gap-0.5">
        <span className="text-[11px] leading-4 text-muted-foreground">部门：{getSubDepartment(sub)}</span>
        <span className="text-[11px] font-bold leading-4 text-slate-600">岗位：{sub.title}</span>
      </div>
      <div className="grid gap-2 border-t border-dashed border-slate-200 pt-2">
        <div className="flex items-center justify-between gap-2 text-[11px] leading-4 text-muted-foreground">
          <span>主考反馈打分</span>
          <b className="text-base leading-5 text-accent-foreground">{score}</b>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="w-full text-[11px] leading-4 text-muted-foreground">主考评价关键词</span>
          {keywords.map((keyword) => (
            <span key={keyword} className="inline-flex min-h-5 items-center rounded-full bg-primary-soft px-2 text-[10px] font-black text-accent-foreground">
              {keyword}
            </span>
          ))}
        </div>
      </div>
    </button>
  );
}

function getSubKeywords(sub: Subordinate, submittedFeedback?: SubmittedFeedback) {
  if (submittedFeedback) {
    return [submittedFeedback.highlights.split(/[，。；、\s]/).filter(Boolean)[0] ?? "反馈完整", "持续跟进"];
  }
  if (sub.status === "not_submitted" || sub.status === "reminded") return ["待提交", "需跟进"];
  if ((sub.score ?? 0) >= 88) return ["高质量交付", "主动协作"];
  if ((sub.score ?? 0) < 80) return ["目标偏差", "需要辅导"];
  return ["节奏稳定", "问题闭环"];
}

function OrgNetworkManagerNode() {
  return (
    <div className="relative w-[260px] rounded-xl border border-solid border-border bg-white/95 px-4 py-3 text-left shadow-[0_16px_38px_rgba(15,23,42,0.07)] transition hover:-translate-y-0.5 hover:border-dashed hover:border-primary/35 hover:bg-gradient-to-br hover:from-white hover:to-primary-soft/40 hover:shadow-[0_20px_42px_rgba(15,23,42,0.09)]">
      <span className="mb-2 block h-1.5 w-14 rounded-full bg-primary" />
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft font-bold text-accent-foreground shadow-inner">
          {CURRENT_USER.initial}
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-foreground">{CURRENT_USER.name}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{CURRENT_USER.title}</p>
        </div>
      </div>
    </div>
  );
}

function OrgNetworkGroupNode({
  title,
  count,
  active,
  onClick,
}: {
  title: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative min-h-[100px] rounded-xl border border-solid px-3 py-3 text-center transition hover:-translate-y-0.5 hover:border-dashed hover:border-primary/35 hover:bg-gradient-to-br hover:from-white hover:to-primary-soft/40 hover:shadow-[0_18px_36px_rgba(15,23,42,0.08)] ${
        active
          ? "border-primary/30 bg-gradient-to-br from-white to-primary-soft/40 shadow-[0_16px_34px_rgba(15,23,42,0.08)]"
          : "border-border bg-white/92 shadow-[0_12px_28px_rgba(15,23,42,0.045)]"
      }`}
    >
      <span className="absolute -top-1 left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full border-2 border-primary bg-white" />
      <p className="text-sm font-bold text-foreground">{title}</p>
      <p className="mt-2 text-2xl font-bold leading-none text-accent-foreground">{count}</p>
      <p className="mt-1 text-[11px] font-medium text-muted-foreground">人</p>
    </button>
  );
}

function OrgNetworkDepartmentBranch({
  department,
  members,
  selectedId,
  previewSubId,
  branchIndex,
  onSelect,
  submittedFeedbackBySubId,
}: {
  department: string;
  members: Subordinate[];
  selectedId?: string;
  previewSubId?: string | null;
  branchIndex: number;
  onSelect: (sub: Subordinate) => void;
  submittedFeedbackBySubId: Record<string, SubmittedFeedback>;
}) {
  void branchIndex;

  return (
    <section className="relative overflow-visible pt-7">
      <span className="org-flow-line absolute left-1/2 top-[-12px] h-8 w-0.5 -translate-x-1/2 rounded-full" />
      <span className="absolute left-1/2 top-[-15px] h-3 w-3 -translate-x-1/2 rounded-full border-2 border-primary bg-white shadow-[0_0_0_4px_rgba(134,144,156,0.12)]" />

      <div className="relative space-y-3 rounded-2xl border border-border bg-white/76 p-3 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
        <span className="absolute -top-3 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full border-2 border-primary bg-white" />
        {members.map((sub) => (
          <OrgNetworkPersonNode
            key={sub.id}
            sub={sub}
            department={department}
            selected={selectedId === sub.id}
            previewOpen={previewSubId === sub.id}
            onSelect={() => onSelect(sub)}
            submittedFeedback={submittedFeedbackBySubId[sub.id]}
          />
        ))}
      </div>
    </section>
  );
}

function OrgNetworkPersonNode({
  sub,
  department,
  selected,
  previewOpen,
  onSelect,
  submittedFeedback,
}: {
  sub: Subordinate;
  department: string;
  selected: boolean;
  previewOpen: boolean;
  onSelect: () => void;
  submittedFeedback?: SubmittedFeedback;
}) {
  const statusMap: Record<SubStatus, { text: string; cls: string }> = {
    pending_feedback: { text: "待反馈", cls: "bg-primary-soft text-accent-foreground" },
    not_submitted: { text: "未提交", cls: "bg-warning-soft text-warning" },
    reminded: { text: "已催办", cls: "bg-warning-soft text-warning" },
    confirmed: { text: "已确认", cls: "bg-success-soft text-success" },
  };
  const status = statusMap[sub.status];
  const score = getLastSupervisorScore(sub, submittedFeedback);
  const aiSummary = getSupervisorAiSummary(submittedFeedback);

  return (
    <div className="relative overflow-visible">
      <button
        type="button"
        onClick={onSelect}
        className={`relative min-h-[300px] w-full overflow-hidden rounded-xl border border-solid px-3 py-3 text-left transition duration-200 hover:-translate-y-0.5 hover:border-dashed hover:border-primary/35 hover:bg-gradient-to-br hover:from-white hover:via-primary-soft/30 hover:to-white hover:shadow-[0_18px_38px_rgba(15,23,42,0.08)] ${
          selected
            ? "border-primary/30 bg-gradient-to-br from-white via-primary-soft/35 to-white shadow-[0_18px_36px_rgba(15,23,42,0.08)]"
            : "border-border bg-white/92 shadow-[0_10px_24px_rgba(15,23,42,0.045)]"
        }`}
        title={`${sub.name} · ${sub.title}`}
      >
        <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-primary/80" />
        <div className="absolute right-3 top-3 flex items-center gap-0.5 text-primary/45" aria-hidden="true">
          <span className="h-1 w-1 rounded-full bg-current" />
          <span className="h-1 w-1 rounded-full bg-current" />
          <span className="h-1 w-1 rounded-full bg-current" />
        </div>

        <div className="space-y-3 pl-1">
          <p className="max-w-[calc(100%-2rem)] truncate text-[11px] font-semibold text-muted-foreground">所属部门：{department}</p>

          <div className="flex items-center gap-2.5 pr-3">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold shadow-sm ${
              selected ? "bg-white text-accent-foreground ring-2 ring-primary/35" : "bg-primary-soft text-accent-foreground"
            }`}>
              {sub.initial}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate text-sm font-bold text-foreground">{sub.name}</span>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${status.cls}`}>
                  {status.text}
                </span>
              </div>
              <p className="mt-1 line-clamp-2 text-[11px] leading-tight text-muted-foreground">岗位：{sub.title}</p>
            </div>
          </div>

          <div className="border-t border-primary/10 pt-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-muted-foreground">主考评分</span>
              <span className="text-base font-bold leading-none text-accent-foreground">{score}</span>
            </div>
            <div className="space-y-2">
              <OrgCardNameGroup label="核心 KPI" names={SUB_KPIS.map((item) => item.title)} />
              <OrgCardNameGroup label="关键工作" names={SUB_KEY_WORK.map((item) => item.title)} />
            </div>
          </div>

          <div className="rounded-lg bg-secondary/45 px-3 py-2">
            <p className="text-[10px] font-semibold text-muted-foreground">主考评价 AI 摘要</p>
            <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-foreground">{aiSummary}</p>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium text-muted-foreground">绩效汇报状态</span>
            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${status.cls}`}>
              {status.text}
            </span>
          </div>
        </div>
      </button>

      {previewOpen && <span className="pointer-events-none absolute inset-0 rounded-xl ring-2 ring-primary/45 ring-offset-2 ring-offset-white" />}
    </div>
  );
}

function OrgCardNameGroup({ label, names }: { label: string; names: string[] }) {
  return (
    <div className="rounded-lg bg-white/70 px-2.5 py-2 ring-1 ring-primary/10">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold text-muted-foreground">{label}</p>
        <span className="text-[10px] font-bold text-accent-foreground">{names.length} 项</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {names.slice(0, 3).map((name) => (
          <span key={name} className="max-w-full truncate rounded-md bg-primary-soft px-1.5 py-0.5 text-[10px] font-medium text-accent-foreground">
            {name}
          </span>
        ))}
        {names.length > 3 && (
          <span className="rounded-md bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
            +{names.length - 3}
          </span>
        )}
      </div>
    </div>
  );
}

function OrgTopNode({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="min-w-[250px] rounded-2xl bg-card/95 px-4 py-3 shadow-[0_14px_34px_rgba(15,23,42,0.07)]">
      <div className="flex items-center gap-3">
        <img
          src={MANAGER_AVATAR_URL}
          alt={title}
          className="h-10 w-10 rounded-xl object-cover shadow-inner ring-1 ring-white"
        />
        <div className="min-w-0">
          <p className="text-sm font-semibold tracking-wide">{title}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>
        </div>
      </div>
    </div>
  );
}

function OrgBranchNode({
  title,
  count,
  active,
  onClick,
}: {
  title: string;
  count: number;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`min-w-0 rounded-xl px-3 py-2.5 text-center shadow-[0_12px_30px_rgba(15,23,42,0.05)] ring-1 transition ${
        active
          ? "bg-white text-foreground ring-primary/18 shadow-[0_18px_38px_rgba(15,23,42,0.08)]"
          : "bg-card/95 text-foreground ring-border/60 hover:-translate-y-0.5 hover:bg-white hover:ring-primary/12 hover:shadow-[0_18px_34px_rgba(15,23,42,0.07)]"
      }`}
    >
      <p className="text-sm font-semibold">{title}</p>
      <p className={`mt-1 text-xl font-bold leading-none ${active ? "text-accent-foreground" : "text-foreground"}`}>{count}</p>
      <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">人</p>
    </button>
  );
}

function OrgPeopleList({
  subs,
  selectedId,
  onSelect,
}: {
  subs: Subordinate[];
  selectedId?: string;
  onSelect: (sub: Subordinate) => void;
}) {
  return (
    <section className="relative w-full min-w-0 overflow-hidden rounded-xl bg-card/90 p-2.5 shadow-[0_12px_28px_rgba(15,23,42,0.05)]">
      <div className="max-h-[52vh] space-y-2 overflow-x-hidden overflow-y-auto pr-0.5">
        {subs.length > 0 ? (
          subs.map((sub) => (
            <OrgPersonCard
              key={sub.id}
              sub={sub}
              selected={selectedId === sub.id}
              onSelect={() => onSelect(sub)}
            />
          ))
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-white/80 px-3 py-6 text-center text-xs font-semibold text-muted-foreground">
            当前筛选下暂无下属
          </div>
        )}
      </div>
    </section>
  );
}

function OrgPersonCard({
  sub,
  selected,
  onSelect,
}: {
  sub: Subordinate;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={`relative w-full min-w-0 overflow-hidden rounded-xl px-2.5 py-2.5 text-left ring-1 transition duration-200 ${
        selected
          ? "bg-white text-foreground ring-primary/18 shadow-[0_18px_36px_rgba(15,23,42,0.08)]"
          : "bg-card/95 text-foreground ring-transparent shadow-[0_10px_24px_rgba(15,23,42,0.045)] hover:-translate-y-0.5 hover:bg-white hover:ring-primary/12 hover:shadow-[0_18px_34px_rgba(15,23,42,0.07)]"
      }`}
      title={`${sub.name} · ${sub.title}`}
    >
      {selected && <span className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-primary" />}
      <div className="flex min-w-0 items-start gap-2.5">
        <img
          src={getPersonAvatarUrl(sub.id, sub.name)}
          alt={sub.name}
          className={`h-8 w-8 shrink-0 rounded-lg object-cover shadow-sm ${selected ? "ring-2 ring-primary/35" : "ring-1 ring-white"}`}
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-semibold leading-tight truncate">{sub.name}</p>
            <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium shrink-0 ${
              sub.status === "confirmed"
                ? "bg-success-soft text-success"
                : sub.status === "pending_feedback"
                  ? "bg-primary-soft text-accent-foreground"
                  : "bg-warning-soft text-warning"
            }`}>
              {sub.status === "pending_feedback" ? "待反馈" : sub.status === "confirmed" ? "已确认" : sub.status === "reminded" ? "已催办" : "未提交"}
            </span>
          </div>
          <p className="mt-1 text-[11px] leading-tight text-muted-foreground line-clamp-2">{sub.title}</p>
        </div>
      </div>
    </button>
  );
}

type PerformancePanelTab = "assessment" | "responsibilities" | "kpi" | "orgTotals" | "vitality" | "profile";

function getPerformancePanelTabs(isManager: boolean): Array<{ key: PerformancePanelTab; label: string }> {
  const tabs: Array<{ key: PerformancePanelTab; label: string }> = [
    { key: "assessment", label: "绩效考核" },
    { key: "responsibilities", label: "岗位职责" },
    { key: "kpi", label: "KPI" },
    { key: "orgTotals", label: "架构与三总额" },
  ];
  return isManager ? [...tabs, { key: "vitality", label: "组织活力" }] : tabs;
}

function SubordinatePerformancePanel({
  sub,
  submittedFeedback,
  onWriteFeedback,
  onRemind,
  remindCooldownMs,
  compact = false,
  showExpandButton = false,
  expanded = false,
  onToggleExpanded,
  onBackToTeam,
  headerActions,
  hidePrimaryAction = false,
  isManager = false,
  submittedPersonalReports = {},
  versionThreeLayout = false,
}: {
  sub: Subordinate;
  submittedFeedback?: SubmittedFeedback;
  onWriteFeedback: () => void;
  onRemind: () => void;
  remindCooldownMs: number;
  compact?: boolean;
  showExpandButton?: boolean;
  expanded?: boolean;
  onToggleExpanded?: () => void;
  onBackToTeam?: () => void;
  headerActions?: React.ReactNode;
  hidePrimaryAction?: boolean;
  isManager?: boolean;
  submittedPersonalReports?: Record<string, SubmittedPersonalMonthlyReport>;
  versionThreeLayout?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<PerformancePanelTab>("assessment");
  const [managerReportPeriod, setManagerReportPeriod] = useState(getCurrentMonthPeriod());
  const [subReportPeriod, setSubReportPeriod] = useState(getCurrentMonthPeriod());
  const [feedbackOpen, setFeedbackOpen] = useState(true);
  const [reportOpen, setReportOpen] = useState(true);
  const submitted = isManager || (sub.status !== "not_submitted" && sub.status !== "reminded");
  const reminded = sub.status === "reminded";
  const cooldownMinutes = Math.ceil(remindCooldownMs / 60000);
  const remindDisabled = reminded && remindCooldownMs > 0;
  const tabs = getPerformancePanelTabs(isManager);
  const supplementalTabs = tabs.filter((tab) => tab.key !== "assessment");
  const switchSupplementalTab = (tab: PerformancePanelTab) => {
    setActiveTab((current) => current === tab ? "assessment" : tab);
  };

  useEffect(() => {
    if (activeTab === "profile") return;
    if (!tabs.some((tab) => tab.key === activeTab)) {
      setActiveTab("assessment");
    }
  }, [activeTab, tabs]);

  return (
    <div className={`flex flex-col ${compact ? "min-h-0" : "h-full min-h-0"}`}>
      <div className="border-b border-border px-5 py-4 bg-secondary/30">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex min-w-[220px] flex-1 items-start gap-4">
            <button
              type="button"
              onClick={() => setActiveTab("profile")}
              className="group/profile relative shrink-0 rounded-xl text-left focus:outline-none focus:ring-2 focus:ring-primary/25"
            >
              <Avatar
                initial={sub.initial}
                size="lg"
                src={isManager ? MANAGER_AVATAR_URL : getPersonAvatarUrl(sub.id, sub.name)}
                alt={sub.name}
              />
              <span className="pointer-events-none absolute left-0 top-[calc(100%+8px)] z-30 hidden w-max max-w-[260px] rounded-lg border border-border bg-white px-3 py-2 text-xs font-semibold text-foreground shadow-[0_14px_34px_rgba(15,23,42,0.14)] group-hover/profile:block">
                点击查看员工档案和排名
              </span>
            </button>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-semibold">{sub.name}</h2>
                {!isManager && <StatusPill status={sub.status} />}
                {!isManager && (
                  <span className="text-xs px-2 py-0.5 rounded-md bg-card border border-border text-muted-foreground">
                    {sub.type === "direct" ? "直接下属" : "间接下属"}
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{sub.title}</p>
              {versionThreeLayout && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {activeTab !== "assessment" && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("assessment")}
                      className="inline-flex h-7 items-center gap-1 rounded-lg border border-primary/25 bg-primary-soft px-2.5 text-xs font-bold text-primary transition hover:border-primary/40 hover:bg-primary-soft/80"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      返回绩效考核
                    </button>
                  )}
                  {supplementalTabs.map((tab) => {
                    const active = activeTab === tab.key;
                    return (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => switchSupplementalTab(tab.key)}
                        className={`inline-flex h-7 items-center rounded-lg border px-2.5 text-xs font-bold transition ${
                          active
                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                            : "border-border bg-white text-muted-foreground hover:border-primary/35 hover:bg-primary-soft hover:text-accent-foreground"
                        }`}
                        aria-pressed={active}
                      >
                        {tab.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
          <div className="ml-auto flex shrink-0 flex-wrap items-center justify-end gap-2">
            {headerActions}
            {!headerActions && showExpandButton && onToggleExpanded && (
              <button
                type="button"
                onClick={onToggleExpanded}
                className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-white text-muted-foreground transition hover:border-primary/35 hover:bg-primary-soft hover:text-accent-foreground"
                aria-label={expanded ? "退出全屏查看绩效卡片" : "全屏查看绩效卡片"}
                title={expanded ? "退出全屏" : "扩展全屏"}
              >
                {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
            )}
            {!hidePrimaryAction && !isManager && (submitted ? (
              <button
                onClick={onWriteFeedback}
                className="px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition flex items-center gap-1.5"
              >
                <Pencil className="h-3.5 w-3.5" /> 写反馈
              </button>
            ) : (
              <button
                onClick={onRemind}
                disabled={remindDisabled}
                className="px-3.5 py-2 rounded-lg bg-warning text-white text-sm font-medium hover:opacity-90 transition flex items-center gap-1.5 disabled:bg-muted disabled:text-muted-foreground"
              >
                <Bell className="h-3.5 w-3.5" />
                {remindDisabled ? `${cooldownMinutes}分钟后可催办` : reminded ? "再次催办" : "催办"}
              </button>
            ))}
            {reminded && (
              <span className="max-w-28 text-xs text-warning bg-warning-soft/60 border border-warning/20 rounded-lg px-2.5 py-2 leading-tight">
                {remindDisabled ? `${cooldownMinutes} 分钟冷却中` : "冷却结束，可再次催办"}
              </span>
            )}
          </div>
        </div>
      </div>

      {!versionThreeLayout && (
      <div className="border-b border-border bg-white px-5">
        <div className="flex h-12 items-end gap-7 overflow-x-auto [scrollbar-width:none]">
          {tabs.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`relative h-12 shrink-0 px-1 text-sm font-semibold transition ${
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
                aria-pressed={active}
              >
                {tab.label}
                <span className={`absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary transition ${active ? "opacity-100" : "opacity-0"}`} />
              </button>
            );
          })}
        </div>
      </div>
      )}

      <div className={`${compact ? "" : "flex-1 overflow-y-auto"} bg-white p-5`}>
        {activeTab === "assessment" && (
          isManager ? (
            <ManagerPersonalAssessmentTab
              period={managerReportPeriod}
              onPeriodChange={setManagerReportPeriod}
              showGoalPreview={expanded}
              submittedPersonalReports={submittedPersonalReports}
            />
          ) : (
            <div className="space-y-4">
              <div className="flex justify-end">
                <select
                  value={subReportPeriod}
                  onChange={(event) => setSubReportPeriod(event.target.value)}
                  className="h-9 rounded-lg border border-border bg-white px-3 text-xs font-bold text-foreground shadow-sm"
                  aria-label="选择下属绩效考核月份"
                >
                  {getSubMonthlyPeriodOptions().map((item, index) => (
                    <option key={item} value={item}>
                      {item}{index === 0 ? "（当前）" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <SupervisorFeedbackCard
                sub={sub}
                submittedFeedback={submittedFeedback}
                period={subReportPeriod}
                feedback={getSubFeedbackForPeriod(sub, subReportPeriod, submittedFeedback)}
                hasFeedback={hasSubFeedbackForPeriod(sub, subReportPeriod, submittedFeedback)}
                open={feedbackOpen}
                onToggle={() => setFeedbackOpen((v) => !v)}
              />
              <MonthlyReportSummaryCard
                sub={sub}
                period={subReportPeriod}
                report={getSubMonthlyReportForPeriod(subReportPeriod)}
                hasReport={hasSubMonthlyReportForPeriod(sub, subReportPeriod)}
                open={reportOpen}
                onToggle={() => setReportOpen((v) => !v)}
                showGoalPreview={expanded}
              />
            </div>
          )
        )}
        {activeTab === "responsibilities" && <ResponsibilitiesPanel sub={sub} isManager={isManager} expanded={expanded} contained={versionThreeLayout} />}
        {activeTab === "kpi" && <KpiPanel sub={sub} isManager={isManager} />}
        {activeTab === "orgTotals" && <OrgTotalsPanel sub={sub} isManager={isManager} />}
        {activeTab === "vitality" && isManager && <OrgVitalityPanel />}
        {activeTab === "profile" && <EmployeeProfilePanel sub={sub} isManager={isManager} onBack={() => setActiveTab("assessment")} />}
      </div>
    </div>
  );
}

function ManagerPersonalAssessmentTab({
  period,
  onPeriodChange,
  showGoalPreview,
  submittedPersonalReports,
}: {
  period: string;
  onPeriodChange: (period: string) => void;
  showGoalPreview: boolean;
  submittedPersonalReports: Record<string, SubmittedPersonalMonthlyReport>;
}) {
  const periodOptions = getPersonalMonthlyPeriodOptions();
  const submittedReport = submittedPersonalReports[period];
  const feedback = getPersonalFeedbackForPeriod(period);
  const report = submittedReport?.report ?? getPersonalMonthlyReportForPeriod(period);
  const hasFeedback = hasPersonalFeedbackForPeriod(period);
  const hasReport = Boolean(submittedReport) || hasPersonalMonthlyReportForPeriod(period);
  const kpiItems = submittedReport
    ? submittedReport.metrics.filter((item) => item.tag === "核心 KPI")
    : PERSONAL_KPIS;
  const keyWorkItems = submittedReport
    ? submittedReport.metrics.filter((item) => item.tag === "关键工作")
    : PERSONAL_KEY_WORK;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <select
          value={period}
          onChange={(event) => onPeriodChange(event.target.value)}
          className="h-9 rounded-lg border border-border bg-white px-3 text-xs font-bold text-foreground shadow-sm"
          aria-label="选择绩效考核月份"
        >
          {periodOptions.map((item, index) => (
            <option key={item} value={item}>
              {item}{index === 0 ? "（当前）" : ""}
            </option>
          ))}
        </select>
      </div>
      <PersonalSupervisorFeedbackCard feedback={feedback} hasFeedback={hasFeedback} />
      {hasFeedback && <PersonalSupervisorAiSummaryCard />}
      <PersonalMonthlyReportCard
        report={report}
        showGoalPreview={showGoalPreview}
        hasReport={hasReport}
        kpiItems={kpiItems}
        keyWorkItems={keyWorkItems}
      />
    </div>
  );
}

function EmployeeProfilePanel({
  sub,
  isManager,
  onBack,
}: {
  sub: Subordinate;
  isManager: boolean;
  onBack: () => void;
}) {
  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border bg-white px-3 text-xs font-bold text-muted-foreground transition hover:border-primary/35 hover:bg-primary-soft hover:text-accent-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        返回绩效考核
      </button>
      <RankingPanel sub={sub} />
      {isManager ? <ManagerArchivePanel /> : <ArchivePanel sub={sub} />}
    </div>
  );
}

function ManagerArchivePanel() {
  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.05)] ring-1 ring-border/70">
        <div className="flex items-start gap-5">
          <img
            src={MANAGER_AVATAR_URL}
            alt={CURRENT_USER.name}
            className="h-24 w-24 rounded-full object-cover shadow-sm ring-1 ring-white/90"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h3 className="text-2xl font-bold">{CURRENT_USER.name}</h3>
            </div>
            <p className="mt-2 text-sm text-foreground">{CURRENT_USER.company} · {CURRENT_USER.title}</p>
            <p className="mt-2 text-sm font-semibold text-muted-foreground">上级：{CURRENT_USER.supervisor}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-5 border-t border-border pt-4 text-center">
          {[
            ["角色", "负责人"],
            ["周期", CURRENT_PERIOD],
            ["状态", "已评价"],
            ["评分", "85"],
            ["组织", CURRENT_USER.company],
          ].map(([label, value]) => (
            <div key={label} className="border-r border-border px-3 last:border-r-0">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="mt-1 text-lg font-bold">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.05)] ring-1 ring-border/70">
        <SectionTitle title="个人简介" />
        <p className="mt-4 text-sm leading-relaxed text-foreground">
          {CURRENT_USER.name}，现任{CURRENT_USER.title}，负责产险公司整体经营管理、战略承接、组织协同与重点项目推进。
        </p>
        <div className="mt-4 grid gap-2 text-sm">
          <ArchiveTags label="基础" tags={[CURRENT_USER.company, "经营管理"]} />
          <ArchiveTags label="绩效" tags={["2026年4月绩效追踪", "本人绩效详情"]} />
          <ArchiveTags label="来源" tags={["龙泉架构卡片"]} />
        </div>
      </section>
    </div>
  );
}

function SubordinatePerformanceDrawerCard({
  sub,
  submittedFeedback,
  onClose,
  onWriteFeedback,
  onRemind,
  remindCooldownMs,
  currentIndex,
  totalCount,
  slideDirection,
  onPrev,
  onNext,
}: {
  sub: Subordinate;
  submittedFeedback?: SubmittedFeedback;
  onClose: () => void;
  onWriteFeedback: () => void;
  onRemind: () => void;
  remindCooldownMs: number;
  currentIndex: number;
  totalCount: number;
  slideDirection: "left" | "right";
  onPrev: () => void;
  onNext: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <section
      data-sub-detail-card
      className={`fixed top-[50px] bottom-[1.5rem] left-[1rem] z-[40] min-w-[420px] max-w-[calc(100%-2rem)] animate-in overflow-hidden rounded-2xl border border-primary/20 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.14)] duration-300 ${
        slideDirection === "right" ? "slide-in-from-right-8" : "slide-in-from-left-8"
      }`}
      style={expanded ? { right: "500px", width: "auto" } : { width: 520 }}
      onClick={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        onClick={onPrev}
        className="absolute left-4 top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-white/95 text-foreground shadow-[0_10px_24px_rgba(26,39,63,0.12)] transition hover:border-primary/35 hover:text-accent-foreground"
        aria-label="查看上一个下属"
      >
        <ChevronLeft className="h-5 w-5" />
      </button>
      <button
        type="button"
        onClick={onNext}
        className="absolute right-4 top-1/2 z-20 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full border border-border bg-white/95 text-foreground shadow-[0_10px_24px_rgba(26,39,63,0.12)] transition hover:border-primary/35 hover:text-accent-foreground"
        aria-label="查看下一个下属"
      >
        <ChevronRight className="h-5 w-5" />
      </button>
      <div className="h-full overflow-y-auto">
        <SubordinatePerformancePanel
          sub={sub}
          submittedFeedback={submittedFeedback}
          onWriteFeedback={onWriteFeedback}
          onRemind={onRemind}
          remindCooldownMs={remindCooldownMs}
          compact
          showExpandButton
          expanded={expanded}
          onToggleExpanded={() => setExpanded((value) => !value)}
          headerActions={
            <>
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-muted-foreground shadow-sm ring-1 ring-border">
                {currentIndex}/{totalCount}
              </span>
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-white text-muted-foreground transition hover:border-primary/35 hover:bg-primary-soft hover:text-accent-foreground"
                aria-label={expanded ? "收缩查看绩效卡片" : "扩展查看绩效卡片"}
                title={expanded ? "收缩" : "扩展"}
              >
                {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-white text-muted-foreground transition hover:border-primary/35 hover:bg-primary-soft hover:text-accent-foreground"
                aria-label="关闭下属绩效信息"
                title="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          }
        />
      </div>
    </section>
  );
}

function ManagerPerformanceDrawerCard({
  expanded,
  onToggleExpanded,
  onClose,
}: {
  expanded: boolean;
  onToggleExpanded: () => void;
  onClose: () => void;
}) {
  return (
    <section
      data-sub-detail-card
      className="fixed bottom-[1.5rem] left-[1rem] top-[50px] z-[40] min-w-[420px] max-w-[calc(100%-2rem)] animate-in slide-in-from-left-8 overflow-hidden rounded-2xl border border-primary/20 bg-white shadow-[0_24px_70px_rgba(15,23,42,0.14)] duration-300"
      style={expanded ? { right: "500px", width: "auto" } : { width: 560 }}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="h-full overflow-y-auto">
        <SubordinatePerformancePanel
          sub={MANAGER_DETAIL_SUB}
          onWriteFeedback={() => toast.info("龙泉本人绩效反馈由上级评价流程生成")}
          onRemind={() => toast.info("当前为龙泉本人绩效卡片")}
          remindCooldownMs={0}
          compact
          isManager
          expanded={expanded}
          headerActions={
            <>
              <button
                type="button"
                onClick={onToggleExpanded}
                className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-white text-muted-foreground transition hover:border-primary/35 hover:bg-primary-soft hover:text-accent-foreground"
                aria-label={expanded ? "收缩查看绩效卡片" : "扩展查看绩效卡片"}
                title={expanded ? "收缩" : "扩展"}
              >
                {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-white text-muted-foreground transition hover:border-primary/35 hover:bg-primary-soft hover:text-accent-foreground"
                aria-label="关闭龙泉绩效信息"
                title="关闭"
              >
                <X className="h-4 w-4" />
              </button>
            </>
          }
        />
      </div>
    </section>
  );
}

type RolePrototype = {
  strategyLead: string;
  strategyBullets: string[];
  duties: string[];
  basics: Array<{ label: string; value: string }>;
  capabilityCards: Array<{ title: string; lines: string[]; x: string; y: string; tone?: "warm" | "cool" }>;
  capabilityNodes: Array<{ code: string; label: string; x: number; y: number; active?: boolean }>;
};

type KpiPrototype = {
  date: string;
  score: string;
  scoreParts: Array<{ label: string; value: string }>;
  reached: string;
  missed: string;
  rows: Array<{ group?: string; name: string; weight: string; baseline: string; plan: string; market: string; benchmark: string; status: string; actual: string; score: string }>;
};

type OrgPrototype = {
  date: string;
  top: OrgUnit;
  units: OrgUnit[];
  execRates: Array<{ label: string; value: string }>;
  sections: Array<{ title: string; badge?: string; cards: OrgTotalCard[] }>;
};

type OrgUnit = {
  name: string;
  owner?: string;
  budget: string;
  active: string;
  posts: string;
  levels: [string, string, string];
};

type OrgTotalCard = {
  title: string;
  total: string;
  rows: Array<[string, string]>;
  extra?: Array<[string, string]>;
};

function getRolePrototype(isManager: boolean): RolePrototype {
  return isManager
    ? {
        strategyLead: "承接“自身双优” + “集团中坚”的双定位，持续贡献利润，支撑集团战略，成为全球领先的财产保险服务提供商：",
        strategyBullets: [
          "自身双优：加大利润贡献；持续规模超越",
          "集团中坚：发挥“御林军”作风，支撑集团战略实现，持续贡献客户",
        ],
        duties: [
          "战略引领与落地：主导制定公司中长期战略规划，明确市场定位与增长路径，推动战略解码与高效执行，确保目标达成。",
          "创新驱动与变革：引领数字化转型与科技赋能，探索创新产品、服务模式及生态协同，重塑客户体验与商业模式。",
          "团队文化与组织建设：构建顶尖高管团队与人才梯队，塑造以客户为中心、敏捷高效、合规创新的组织文化与战斗力。",
          "风控与合规经营：筑牢全面风险管理体系，确保资本充足、合规经营及偿付能力稳健，守护公司可持续发展根基。",
        ],
        basics: [
          { label: "年龄", value: "≤55岁" },
          { label: "绩效", value: "连续两年前70%" },
          { label: "学历", value: "本科及以上" },
        ],
        capabilityCards: [
          { title: "行业经验", lines: ["具备金融、保险行业相关经历", "有≥3年中小公司一把手或≥3年大型保险公司副总以上经验"], x: "50%", y: "-1%", tone: "warm" },
          { title: "专业经验", lines: ["精通保险行业经营逻辑，熟悉产险市场及行业生态", "领导过大型变革项目，并形成可复制方法"], x: "15%", y: "27%", tone: "warm" },
          { title: "团队领导", lines: ["通过文化渗透与激励机制，打造狼性团队", "建立“总部-机构”穿透式管理，激活基层"], x: "86%", y: "27%" },
          { title: "资源转化", lines: ["具备丰富的监管、政企客户资源", "并转化为业务合作与战略协同"], x: "12%", y: "49%", tone: "warm" },
          { title: "狼性自驱", lines: ["有使命感；有冲劲；不懈探索", "围绕战略主动转型攻坚，保持高频迭代"], x: "88%", y: "50%" },
          { title: "文化认同", lines: ["深度认同保险业“服务国家战略、保障民生福祉”的行业使命", "对平安文化价值强认同"], x: "17%", y: "70%", tone: "warm" },
          { title: "魄力坚韧", lines: ["在行业增速放缓、利润损风险加剧背景下", "能带领团队逆势突围，平衡短期业绩与长期价值"], x: "85%", y: "70%" },
          { title: "洞察规划", lines: ["有大局观，站得高、看得远", "能穿透行业周期，预判政策、市场及客户需求变化"], x: "50%", y: "88%" },
        ],
        capabilityNodes: [
          { code: "EEQ", label: "经验商", x: 0, y: -152, active: true },
          { code: "L", label: "带队伍", x: 142, y: -86 },
          { code: "AAQ", label: "态度商", x: 164, y: 54 },
          { code: "AQ", label: "逆商", x: 90, y: 164 },
          { code: "T", label: "视事", x: 0, y: 196 },
          { code: "LQ", label: "忠诚商", x: -134, y: 116, active: true },
          { code: "SQ", label: "资源商", x: -162, y: 36, active: true },
          { code: "PQ", label: "专业商", x: -146, y: -76, active: true },
        ],
      }
    : {
        strategyLead: "承接“自身双优” + “集团中坚”的双定位，持续贡献利润，支撑集团战略，成为全球领先的财产保险服务提供商：",
        strategyBullets: [
          "自身双优：加大利润贡献，持续规模超越",
          "集团中坚：发挥“御林军”作风，支撑集团战略实现，持续贡献客户",
        ],
        duties: [
          "战略承接与落地：制定个群业务增长战略，驱动车险份额提升与非车增速，统筹线上平台资源确保承保利润目标达成。",
          "数字化创新变革：创新场景化产品与智能运营模式，通过数字化升级提升车主非车渗透率，优化客户全生命周期价值。",
          "人才梯队与文化建设：构建以COR优化为核心的考核体系，打造高绩效线上团队，强化车险与非险协同作战能力。",
          "风控与合规经营：建立动态定价与成本管控机制，严控车险及个非COR，保障线上业务合规性与承保盈利能力。",
        ],
        basics: [
          { label: "年龄", value: "≤50" },
          { label: "绩效", value: "连续两年前70%" },
          { label: "学历", value: "本科及以上" },
        ],
        capabilityCards: [
          { title: "行业经验", lines: ["具备保险行业经验，其中至少3年聚焦个险渠道管理", "对产险经营理解深刻，有规模化增长实践"], x: "50%", y: "-1%", tone: "warm" },
          { title: "专业经验", lines: ["对个险业务领域有敏锐洞察", "具备个险渠道、平台、产品等全链路专业经验"], x: "15%", y: "27%", tone: "warm" },
          { title: "团队领导", lines: ["通过文化渗透与激励机制，打造狼性团队", "建立“总部-机构”穿透式管理，激活基层"], x: "86%", y: "27%" },
          { title: "文化认同", lines: ["深度认同保险业“服务国家战略、保障民生福祉”的行业使命", "对平安文化价值强认同"], x: "12%", y: "49%", tone: "warm" },
          { title: "洞察规划", lines: ["能穿透行业周期，预判政策、市场及客户需求变化", "制定前瞻性战略，精准定位差异化增长"], x: "88%", y: "49%" },
          { title: "求新求变", lines: ["能够推进新业务领域布局", "紧抓市场机遇及亮点，快速布局发展新蓝海、海外、低空经..."], x: "17%", y: "70%", tone: "warm" },
          { title: "魄力坚韧", lines: ["在行业增速放缓、利润损风险加剧背景下", "能带领团队逆势突围，平衡短期业绩与长期价值"], x: "85%", y: "70%" },
          { title: "狼性自驱", lines: ["有使命感；有冲劲；不懈探索", "围绕战略，主动转型攻坚，保持高频迭代"], x: "50%", y: "88%" },
        ],
        capabilityNodes: [
          { code: "EEQ", label: "经验商", x: 0, y: -152, active: true },
          { code: "L", label: "带队伍", x: 136, y: -86 },
          { code: "T", label: "视事", x: 160, y: 52 },
          { code: "AQ", label: "逆商", x: 88, y: 168 },
          { code: "AAQ", label: "态度商", x: 0, y: 198 },
          { code: "AAQ", label: "态度商", x: -136, y: 112, active: true },
          { code: "LQ", label: "忠诚商", x: -160, y: 36, active: true },
          { code: "PQ", label: "专业商", x: -142, y: -78, active: true },
        ],
      };
}

function ResponsibilitiesPanel({
  sub,
  isManager,
  expanded = false,
  contained = false,
}: {
  sub: Subordinate;
  isManager: boolean;
  expanded?: boolean;
  contained?: boolean;
}) {
  const data = getRolePrototype(isManager);
  const compact = contained || !expanded;

  return (
    <div className={contained ? "w-full min-w-0 overflow-hidden pb-2" : "w-full min-w-0 pb-2"}>
      <section
        className={`${
          expanded && !contained ? "p-5" : "p-3.5"
        } w-full min-w-0 overflow-hidden rounded-2xl bg-white shadow-[0_12px_28px_rgba(15,23,42,0.05)] ring-1 ring-border/70`}
      >
        <div
          className={`grid min-w-0 gap-3 ${
            expanded && !contained
              ? "lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1.35fr)_minmax(0,0.8fr)]"
              : "grid-cols-[repeat(auto-fit,minmax(min(100%,260px),1fr))]"
          }`}
        >
          <RoleStrategyCard data={data} compact={compact} />
          <RoleDutiesCard data={data} compact={compact} />
          <RoleBasicsCard data={data} compact={compact} />
        </div>
        <div className="mt-5">
          <RoleCapabilityMap data={data} compact={contained} />
        </div>
      </section>
    </div>
  );
}

function RoleStrategyCard({ data, compact = false }: { data: RolePrototype; compact?: boolean }) {
  return (
    <article className={`${compact ? "min-h-[220px] px-4 py-4" : "min-h-[260px] px-6 py-6"} min-w-0 rounded-lg bg-white shadow-[0_8px_28px_rgba(15,23,42,0.06)] ring-1 ring-border/80`}>
      <RoleSectionTitle icon={<Target className="h-3.5 w-3.5" />} title="战略定位" compact={compact} />
      <div className={`${compact ? "mt-3 text-[11px] leading-5" : "mt-5 pl-3 text-[13px] leading-7"} break-words font-semibold text-slate-800`}>
        <p className={compact ? "" : "indent-8"}>{data.strategyLead}</p>
        <ul className={`${compact ? "mt-3 space-y-1 pl-4" : "mt-5 space-y-2"}`}>
          {data.strategyBullets.map((item) => (
            <li key={item} className="list-disc pl-1">{item}</li>
          ))}
        </ul>
      </div>
    </article>
  );
}

function RoleDutiesCard({ data, compact = false }: { data: RolePrototype; compact?: boolean }) {
  return (
    <article className={`${compact ? "min-h-[220px] px-4 py-4" : "min-h-[260px] px-6 py-6"} min-w-0 rounded-lg bg-white shadow-[0_8px_28px_rgba(15,23,42,0.06)] ring-1 ring-border/80`}>
      <RoleSectionTitle icon={<BriefcaseBusiness className="h-3.5 w-3.5" />} title="岗位职责" compact={compact} />
      <ol className={`${compact ? "mt-3 space-y-1.5 text-[11px] leading-5" : "mt-5 space-y-2 text-[13px] leading-6"} font-semibold text-slate-800`}>
        {data.duties.map((item, index) => (
          <li key={item} className="flex min-w-0 gap-2">
            <span className="shrink-0">{index + 1}、</span>
            <span className="min-w-0 break-words">{item}</span>
          </li>
        ))}
      </ol>
    </article>
  );
}

function RoleBasicsCard({ data, compact = false }: { data: RolePrototype; compact?: boolean }) {
  return (
    <article className={`${compact ? "min-h-[220px] px-4 py-4" : "min-h-[260px] px-6 py-6"} min-w-0 rounded-lg bg-white shadow-[0_8px_28px_rgba(15,23,42,0.06)] ring-1 ring-border/80`}>
      <RoleSectionTitle icon={<FileText className="h-3.5 w-3.5" />} title="基础要求" compact={compact} />
      <ul className={`${compact ? "mt-3 space-y-2.5 pl-4 text-[11px] leading-5" : "mt-5 space-y-3 pl-6 text-[13px] leading-6"} font-semibold text-slate-500`}>
        {data.basics.map((item) => (
          <li key={item.label} className="list-disc marker:text-slate-300">
            <span>{item.label}：</span>
            <span className="ml-3 text-slate-800">{item.value}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

function RoleSectionTitle({ icon, title, compact = false }: { icon: React.ReactNode; title: string; compact?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <span className={`${compact ? "h-4" : "h-5"} w-1 rounded-full bg-primary`} />
      <span className="text-primary">{icon}</span>
      <span className={`${compact ? "text-sm" : "text-base"} font-black text-slate-700`}>{title}</span>
    </div>
  );
}

function RoleCapabilityMap({ data, compact = false }: { data: RolePrototype; compact?: boolean }) {
  const polygon = "180,42 300,91 330,220 246,322 112,322 30,220 58,91";

  if (compact) {
    return (
      <article className="min-w-0 overflow-hidden rounded-lg bg-white px-4 py-4 shadow-[0_8px_28px_rgba(15,23,42,0.06)] ring-1 ring-border/80">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <RoleSectionTitle icon={<Target className="h-4 w-4" />} title="能力要求" compact />
          <div className="inline-flex shrink-0 gap-2">
            <button type="button" className="h-8 rounded-md border border-border bg-white px-3 text-xs font-bold text-slate-500 shadow-sm">
              共性标签
            </button>
            <button type="button" className="h-8 rounded-md border border-primary/20 bg-primary-soft px-3 text-xs font-bold text-accent-foreground shadow-sm">
              个性标签
            </button>
          </div>
        </div>

        <div className="mt-4 grid min-w-0 gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
          <div className="relative mx-auto aspect-square w-full max-w-[430px]">
            <div className="absolute inset-4 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--primary)_12%,transparent)_0%,color-mix(in_oklch,var(--primary)_4%,transparent)_45%,rgba(255,255,255,0)_68%)]" />
            <svg viewBox="0 0 360 360" className="absolute inset-0 h-full w-full">
              {[0.34, 0.58, 0.82, 1].map((scale) => (
                <polygon
                  key={scale}
                  points={polygon
                    .split(" ")
                    .map((point) => {
                      const [x, y] = point.split(",").map(Number);
                      return `${180 + (x - 180) * scale},${180 + (y - 180) * scale}`;
                    })
                    .join(" ")}
                  fill={scale === 0.82 ? "color-mix(in oklch, var(--primary) 7%, transparent)" : "none"}
                  stroke={scale === 1 ? "color-mix(in oklch, var(--primary) 24%, transparent)" : "rgba(148,163,184,0.18)"}
                  strokeWidth={scale === 1 ? 2 : 1}
                />
              ))}
              {polygon.split(" ").map((point) => {
                const [x, y] = point.split(",").map(Number);
                return <line key={point} x1="180" y1="180" x2={x} y2={y} stroke="rgba(148,163,184,0.18)" />;
              })}
              <polygon points="180,82 264,116 284,216 224,292 132,292 76,216 96,116" fill="color-mix(in oklch, var(--primary) 13%, transparent)" stroke="color-mix(in oklch, var(--primary) 62%, transparent)" strokeWidth="2" />
              {["180,82", "264,116", "284,216", "224,292", "132,292", "76,216", "96,116"].map((point) => {
                const [x, y] = point.split(",").map(Number);
                return <circle key={point} cx={x} cy={y} r="5" fill="#fff" stroke="color-mix(in oklch, var(--primary) 72%, transparent)" strokeWidth="2" />;
              })}
            </svg>

            {data.capabilityNodes.map((node, index) => (
              <div
                key={`${node.code}-${node.label}-${index}`}
                className={`absolute z-20 grid h-14 w-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border text-center shadow-[0_8px_20px_rgba(15,23,42,0.08)] ${
                  node.active
                    ? "border-primary/25 bg-primary-soft text-accent-foreground"
                    : "border-slate-200 bg-slate-50 text-slate-500"
                }`}
                style={{ left: `${((180 + node.x) / 360) * 100}%`, top: `${((180 + node.y) / 360) * 100}%` }}
              >
                <span className="text-sm font-black leading-4">{node.code}</span>
                <span className="block text-[10px] font-black leading-3">{node.label}</span>
              </div>
            ))}
          </div>

          <div className="grid min-w-0 content-start gap-3 sm:grid-cols-2">
            {data.capabilityCards.map((card) => (
              <div
                key={card.title}
                className={`min-w-0 rounded-lg px-4 py-3 text-[12px] leading-5 shadow-[0_10px_24px_rgba(15,23,42,0.05)] ${
                  card.tone === "warm" ? "bg-primary-soft/70 text-accent-foreground" : "bg-slate-50 text-slate-600"
                }`}
              >
                <p className="mb-1.5 text-sm font-black text-slate-700">{card.title}</p>
                <ol className="space-y-1">
                  {card.lines.map((line, index) => (
                    <li key={line} className="break-words">
                      {index + 1}、{line}
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="min-w-0 rounded-lg bg-white px-9 py-8 shadow-[0_8px_28px_rgba(15,23,42,0.06)] ring-1 ring-border/80">
      <div className="flex items-start justify-between gap-5">
        <RoleSectionTitle icon={<Target className="h-4 w-4" />} title="能力要求" />
        <div className="inline-flex gap-3">
          <button type="button" className="h-10 rounded-md border border-border bg-white px-5 text-sm font-bold text-slate-500 shadow-sm">
            共性标签
          </button>
          <button type="button" className="h-10 rounded-md border border-primary/20 bg-primary-soft px-5 text-sm font-bold text-accent-foreground shadow-sm">
            个性标签
          </button>
        </div>
      </div>

      <div className="relative mx-auto mt-4 h-[820px] max-w-[1040px]">
        <div className="absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2">
          <div className="absolute inset-0 rounded-full bg-[radial-gradient(circle,color-mix(in_oklch,var(--primary)_12%,transparent)_0%,color-mix(in_oklch,var(--primary)_4%,transparent)_45%,rgba(255,255,255,0)_68%)]" />
          <svg viewBox="0 0 360 360" className="absolute inset-0 h-full w-full">
            {[0.34, 0.58, 0.82, 1].map((scale) => (
              <polygon
                key={scale}
                points={polygon
                  .split(" ")
                  .map((point) => {
                    const [x, y] = point.split(",").map(Number);
                    return `${180 + (x - 180) * scale},${180 + (y - 180) * scale}`;
                  })
                  .join(" ")}
                fill={scale === 0.82 ? "color-mix(in oklch, var(--primary) 7%, transparent)" : "none"}
                stroke={scale === 1 ? "color-mix(in oklch, var(--primary) 24%, transparent)" : "rgba(148,163,184,0.18)"}
                strokeWidth={scale === 1 ? 2 : 1}
              />
            ))}
            {polygon.split(" ").map((point) => {
              const [x, y] = point.split(",").map(Number);
              return <line key={point} x1="180" y1="180" x2={x} y2={y} stroke="rgba(148,163,184,0.18)" />;
            })}
            <polygon points="180,82 264,116 284,216 224,292 132,292 76,216 96,116" fill="color-mix(in oklch, var(--primary) 13%, transparent)" stroke="color-mix(in oklch, var(--primary) 62%, transparent)" strokeWidth="2" />
            {["180,82", "264,116", "284,216", "224,292", "132,292", "76,216", "96,116"].map((point) => {
              const [x, y] = point.split(",").map(Number);
              return <circle key={point} cx={x} cy={y} r="5" fill="#fff" stroke="color-mix(in oklch, var(--primary) 72%, transparent)" strokeWidth="2" />;
            })}
          </svg>

          {data.capabilityNodes.map((node, index) => (
            <div
              key={`${node.code}-${node.label}-${index}`}
              className={`absolute z-20 grid h-[82px] w-[82px] place-items-center rounded-full border text-center shadow-[0_12px_28px_rgba(15,23,42,0.08)] ${
                node.active
                  ? "border-primary/25 bg-primary-soft text-accent-foreground"
                  : "border-slate-200 bg-slate-50 text-slate-500"
              }`}
              style={{ left: `calc(50% + ${node.x * 1.22}px - 41px)`, top: `calc(50% + ${node.y * 1.22}px - 41px)` }}
            >
              <span className="text-lg font-black leading-5">{node.code}</span>
              <span className="mt-1 block text-sm font-black leading-4">{node.label}</span>
            </div>
          ))}
        </div>

        {data.capabilityCards.map((card) => (
          <div
            key={card.title}
            className={`absolute z-10 w-[230px] rounded-lg px-5 py-4 text-[13px] leading-6 shadow-[0_10px_24px_rgba(15,23,42,0.05)] ${
              card.tone === "warm" ? "bg-primary-soft/70 text-accent-foreground" : "bg-slate-50 text-slate-600"
            }`}
            style={{ left: card.x, top: card.y, transform: "translateX(-50%)" }}
          >
            <p className="mb-2 text-sm font-black text-slate-700">{card.title}</p>
            <ol className="space-y-1">
              {card.lines.map((line, index) => (
                <li key={line} className="line-clamp-3">
                  {index + 1}、{line}
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </article>
  );
}

function getKpiPrototype(isManager: boolean): KpiPrototype {
  return isManager
    ? {
        date: "2025-12",
        score: "103.3分",
        scoreParts: [
          { label: "规模指标", value: "122.4" },
          { label: "质量指标", value: "36.6" },
          { label: "加减分项", value: "5.1" },
        ],
        reached: "3/3",
        missed: "0/3",
        rows: [
          { group: "规模指标", name: "考核利润（亿）", weight: "50.0%", baseline: "COR亏损", plan: "车险143亿", market: "COR优于市场", benchmark: "COR优于人...", status: "超计划线", actual: "165.4", score: "122.4" },
          { group: "质量指标", name: "整体份额提升", weight: "25.00%", baseline: "-0.5pt", plan: "四条线均值...", market: "0pt", benchmark: "超人太", status: "超市场线", actual: "0.2%", score: "20.4" },
          { name: "整体COR优于市场", weight: "25.00%", baseline: "-0.5pt", plan: "0pt", market: "0pt", benchmark: "超人太均值", status: "超市场线", actual: "0.4%", score: "16.2" },
          { group: "加减分项", name: "管理净利润（亿）", weight: "[-6.0]", baseline: "-", plan: "-", market: "-", benchmark: "-", status: "-", actual: "170", score: "0" },
          { name: "非车业务占比", weight: "[-2.0]", baseline: "-", plan: "-", market: "-", benchmark: "-", status: "-", actual: "0.3", score: "0" },
          { name: "非车COR", weight: "[-2.0]", baseline: "-", plan: "-", market: "-", benchmark: "-", status: "-", actual: "-", score: "0" },
          { name: "企康", weight: "[-10,10]", baseline: "-", plan: "-", market: "-", benchmark: "-", status: "-", actual: "-", score: "5.4" },
          { name: "K4扣分", weight: "-", baseline: "-", plan: "-", market: "-", benchmark: "-", status: "-", actual: "-", score: "-0.3" },
        ],
      }
    : {
        date: "2025-12",
        score: "103.2分",
        scoreParts: [
          { label: "规模指标", value: "142.9" },
          { label: "质量指标", value: "20.6" },
          { label: "加减分项", value: "2.7" },
        ],
        reached: "3/3",
        missed: "0/3",
        rows: [
          { group: "规模指标", name: "个人承保利润", weight: "50.0%", baseline: "0", plan: "65", market: "个人COR优...", benchmark: "个人COR优...", status: "超市场线", actual: "86.4", score: "142.9" },
          { group: "质量指标", name: "个人份额提升", weight: "25.00%", baseline: "-0.5pt", plan: "0.01pt", market: "0pt", benchmark: "超人太", status: "超计划线", actual: "0.0%", score: "3.4" },
          { name: "车险COR优于市场", weight: "25.00%", baseline: "-0.5pt", plan: "0pt", market: "0pt", benchmark: "超人太均值", status: "超市场线", actual: "0.3%", score: "17.2" },
          { group: "加减分项", name: "车主客均非车保费增速", weight: "[-3.0]", baseline: "-", plan: "-", market: "-", benchmark: "-", status: "-", actual: "8.1%", score: "0" },
          { name: "个非COR", weight: "[-3.0]", baseline: "-", plan: "-", market: "-", benchmark: "-", status: "-", actual: "98.7%", score: "0" },
          { name: "企康", weight: "[-5,5]", baseline: "-", plan: "-", market: "-", benchmark: "-", status: "-", actual: "-", score: "2.7" },
        ],
      };
}

function KpiPanel({ sub, isManager }: { sub: Subordinate; isManager: boolean }) {
  const data = getKpiPrototype(isManager || sub.name !== "丁珂珂" ? isManager : false);
  const groupedRows = data.rows.reduce<Array<{ group: string; rows: KpiPrototype["rows"] }>>((groups, row) => {
    const groupName = row.group ?? groups.at(-1)?.group ?? "其他指标";
    const group = groups.find((item) => item.group === groupName);
    if (group) {
      group.rows.push(row);
    } else {
      groups.push({ group: groupName, rows: [row] });
    }
    return groups;
  }, []);
  const coreGroups = groupedRows.filter((group) => group.group === "规模指标" || group.group === "质量指标");
  const bonusGroups = groupedRows.filter((group) => group.group === "加减分项");
  const otherGroups = groupedRows.filter((group) => !coreGroups.includes(group) && !bonusGroups.includes(group));
  const coreRows = coreGroups.flatMap((group) => group.rows.map((row) => ({ ...row, group: row.group ?? group.group })));
  const bonusRows = bonusGroups.flatMap((group) => group.rows.map((row) => ({ ...row, group: row.group ?? group.group })));

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <div className="inline-flex h-10 items-center gap-3 rounded-xl border border-border bg-white px-4 text-sm font-bold text-slate-500 shadow-sm">
          截止时间：
          <span className="rounded-lg bg-slate-50 px-4 py-1.5 text-slate-700">{data.date}</span>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <KpiSummaryCard title="综合得分" value={data.score} details={data.scoreParts} />
        <KpiSummaryCard title="达成计划/市场线指标数" value={data.reached} />
        <KpiSummaryCard title="未达底线指标数" value={data.missed} warning />
      </section>

      <section className="space-y-4">
        {coreRows.length > 0 && <KpiCardGroup title="规模指标 / 质量指标" rows={coreRows} dense />}
        {bonusRows.length > 0 && <KpiCardGroup title="加减分项" rows={bonusRows} dense />}
        {otherGroups.map((group) => (
          <KpiCardGroup key={group.group} title={group.group} rows={group.rows} dense />
        ))}
      </section>
    </div>
  );
}

function KpiCardGroup({ title, rows, dense = false }: { title: string; rows: KpiPrototype["rows"]; dense?: boolean }) {
  return (
    <section className="rounded-2xl bg-white p-3.5 shadow-[0_12px_28px_rgba(15,23,42,0.05)] ring-1 ring-border/70">
      <div className="mb-2.5 flex items-center justify-between gap-3">
        <PrototypeTitle title={title} />
        <span className="rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-black text-slate-500">{rows.length}项</span>
      </div>
      <div className={`grid gap-2.5 ${dense ? "md:grid-cols-2 2xl:grid-cols-3 min-[1700px]:grid-cols-4" : "xl:grid-cols-2"}`}>
        {rows.map((row) => (
          <KpiMetricCard key={`${title}-${row.name}`} row={row} />
        ))}
      </div>
    </section>
  );
}

function KpiMetricCard({ row }: { row: KpiPrototype["rows"][number] }) {
  const hasStatus = row.status !== "-";
  return (
    <article className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5 shadow-[0_8px_18px_rgba(15,23,42,0.035)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-slate-800">{row.name}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded bg-white px-1.5 py-0.5 text-[10px] font-black text-slate-400 ring-1 ring-slate-100">
              {row.group ?? "指标"}
            </span>
            <span className="text-[10px] font-bold text-slate-400">权重 {row.weight}</span>
          </div>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-[10px] font-bold text-slate-400">KPI得分</p>
          <p className="mt-0.5 text-lg font-black leading-none text-slate-800">{row.score}</p>
        </div>
      </div>

      <div className="mt-2.5 grid grid-cols-2 gap-1.5">
        <KpiCompactStat label="实际达成" value={row.actual} strong />
        <div className="rounded-lg bg-white px-2.5 py-2 ring-1 ring-slate-100">
          <p className="text-[10px] font-black text-slate-400">考核状态</p>
          <div className="mt-1 min-h-5">
            {hasStatus ? (
              <span className="inline-flex h-5 items-center rounded-md bg-success-soft px-2 text-[10px] font-black text-success">
                {row.status}
              </span>
            ) : (
              <span className="text-sm font-black text-slate-500">-</span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-1.5 grid grid-cols-4 gap-1">
        <KpiLinePill label="底线" value={row.baseline} />
        <KpiLinePill label="计划线" value={row.plan} />
        <KpiLinePill label="市场线" value={row.market} />
        <KpiLinePill label="标杆线" value={row.benchmark} />
      </div>
    </article>
  );
}

function KpiCompactStat({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="rounded-lg bg-white px-2.5 py-2 ring-1 ring-slate-100">
      <p className="text-[10px] font-black text-slate-400">{label}</p>
      <p className={`mt-1 truncate text-sm font-black ${strong ? "text-primary" : "text-slate-700"}`}>{value}</p>
    </div>
  );
}

function KpiLinePill({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-white px-2 py-1.5 text-center ring-1 ring-slate-100">
      <p className="text-[9px] font-black text-slate-400">{label}</p>
      <p className="mt-0.5 truncate text-[11px] font-black text-slate-700">{value}</p>
    </div>
  );
}

function getOrgPrototype(isManager: boolean): OrgPrototype {
  const managerUnits: OrgUnit[] = [
    { name: "个人事业群", owner: "丁珂珂", budget: "-", active: "525", posts: "128", levels: ["-", "17", "111"] },
    { name: "团体事业群", owner: "徐华", budget: "-", active: "835", posts: "117", levels: ["0", "21", "96"] },
    { name: "理赔运营中心", owner: "龙泉", budget: "-", active: "101", posts: "44", levels: ["-", "7", "37"] },
    { name: "科技中心", owner: "樊增建", budget: "-", active: "1933", posts: "329", levels: ["11", "-", "318"] },
    { name: "共同资源中心", owner: "史良洵", budget: "-", active: "368", posts: "82", levels: ["0", "16", "66"] },
  ];
  const dingUnits: OrgUnit[] = [
    { name: "线上渠道平台团队", budget: "-", active: "8", posts: "4", levels: ["-", "1", "3"] },
    { name: "客户经营管理部", budget: "-", active: "83", posts: "16", levels: ["-", "4", "12"] },
    { name: "车险部", budget: "-", active: "48", posts: "12", levels: ["-", "2", "10"] },
    { name: "个人非车及意销部", budget: "-", active: "128", posts: "31", levels: ["-", "5", "26"] },
    { name: "机代管理部", budget: "-", active: "64", posts: "15", levels: ["-", "2", "13"] },
    { name: "作业管理部", budget: "-", active: "86", posts: "24", levels: ["-", "2", "22"] },
    { name: "线上客户平台团队", budget: "-", active: "35", posts: "9", levels: ["-", "1", "8"] },
    { name: "个人代理部", budget: "-", active: "73", posts: "17", levels: ["-", "0", "17"] },
  ];

  return isManager
    ? {
        date: "2026-05",
        top: { name: "平安产险", owner: "龙泉", budget: "-", active: "77705", posts: "10052", levels: ["11", "287", "9754"] },
        units: managerUnits,
        execRates: [
          { label: "职数执行率", value: "98%" },
          { label: "编制执行率", value: "-" },
          { label: "成本执行率", value: "-" },
        ],
        sections: [
          {
            title: "职数",
            badge: "职级占比（在岗职数/实动职数） 13.41%",
            cards: [
              { title: "2026年 在岗", total: "10052人", rows: [["高层", "11"], ["中层", "287"], ["基层", "9754"]], extra: [["M", "1528"], ["P", "2175"], ["F", "6051"]] },
              { title: "2026年 预算", total: "10288人", rows: [["高层", "10"], ["中层", "290"], ["基层", "9988"]], extra: [["M", "1636"], ["P", "2210"], ["F", "6142"]] },
              { title: "2026年 年初", total: "10160人", rows: [["高层", "11"], ["中层", "293"], ["基层", "9856"]], extra: [["M", "1572"], ["P", "2194"], ["F", "6090"]] },
            ],
          },
          {
            title: "编制",
            cards: [
              { title: "2026年 实际", total: "77705人", rows: [["M", "8245"], ["P", "9372"], ["外包", "59273"], ["其他", "815"]] },
              { title: "2026年 预算", total: "-人", rows: [["M", "-"], ["P", "-"], ["F", "-"], ["其他", "-"]] },
              { title: "2026年 年初", total: "-人", rows: [["M", "-"], ["P", "-"], ["F", "-"], ["其他", "-"]] },
            ],
          },
          {
            title: "成本",
            cards: [
              { title: "2026年 实际", total: "-亿", rows: [] },
              { title: "2026年 预算", total: "-亿", rows: [] },
              { title: "2025年 同期", total: "-亿", rows: [] },
            ],
          },
        ],
      }
    : {
        date: "2026-05",
        top: { name: "个人事业群", owner: "丁珂珂", budget: "-", active: "525", posts: "128", levels: ["-", "17", "111"] },
        units: dingUnits,
        execRates: [
          { label: "职数执行率", value: "90%" },
          { label: "编制执行率", value: "-" },
          { label: "成本执行率", value: "-" },
        ],
        sections: [
          {
            title: "职数",
            badge: "职级占比（在岗职数/实动职数） 24.4%",
            cards: [
              { title: "2026年 在岗", total: "128人", rows: [["高层", "-"], ["中层", "17"], ["基层", "111"]], extra: [["A", "50"], ["P", "61"], ["F", "17"]] },
              { title: "2026年 预算", total: "143人", rows: [["高层", "-"], ["中层", "20"], ["基层", "123"]], extra: [["M", "56"], ["P", "67"], ["F", "20"]] },
              { title: "2026年 年初", total: "141人", rows: [["高层", "-"], ["中层", "20"], ["基层", "121"]], extra: [["M", "54"], ["P", "67"], ["F", "20"]] },
            ],
          },
          {
            title: "编制",
            cards: [
              { title: "2026年 实际", total: "525人", rows: [["M", "94"], ["P", "356"], ["F", "-"], ["外包", "75"]] },
              { title: "2026年 预算", total: "-人", rows: [["M", "-"], ["P", "-"], ["F", "-"], ["外包", "-"]] },
              { title: "2026年 年初", total: "-人", rows: [["M", "-"], ["P", "-"], ["F", "-"], ["外包", "-"]] },
            ],
          },
          {
            title: "成本",
            cards: [
              { title: "2026年 实际", total: "-亿", rows: [] },
              { title: "2026年 预算", total: "-亿", rows: [] },
              { title: "2025年 同期", total: "-亿", rows: [] },
            ],
          },
        ],
      };
}

function OrgTotalsPanel({ sub, isManager }: { sub: Subordinate; isManager: boolean }) {
  const data = getOrgPrototype(isManager || sub.name !== "丁珂珂" ? isManager : false);

  return (
    <div className="space-y-5">
      <div className="flex justify-end">
        <div className="inline-flex h-10 items-center gap-3 rounded-xl border border-border bg-white px-4 text-sm font-bold text-slate-500 shadow-sm">
          截止时间：
          <span className="rounded-lg bg-slate-50 px-4 py-1.5 text-slate-700">{data.date}</span>
        </div>
      </div>

      <section className="rounded-2xl bg-slate-50/80 p-5 ring-1 ring-border/70">
        <OrgBlueprint top={data.top} units={data.units} compact={!isManager} />
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.05)] ring-1 ring-border/70">
        {data.sections.map((section) => (
          <div key={section.title} className="mb-6 last:mb-0">
            <div className="mb-4 flex items-center justify-between gap-3">
              <PrototypeTitle title={section.title} />
              {section.badge && (
                <span className="rounded-lg bg-primary-soft px-3 py-1 text-xs font-black text-accent-foreground">{section.badge}</span>
              )}
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              {section.cards.map((card) => (
                <OrgTotalMetricCard key={card.title} card={card} />
              ))}
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function PrototypeTitle({ title }: { title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="h-5 w-1 rounded-full bg-primary" />
      <span className="text-base font-black text-slate-700">{title}</span>
    </div>
  );
}

function CapabilityRadar({ labels, values }: { labels: string[]; values: number[] }) {
  const size = 360;
  const center = size / 2;
  const maxRadius = 130;
  const axis = labels.map((label, index) => {
    const angle = (Math.PI * 2 * index) / labels.length - Math.PI / 2;
    return {
      label,
      x: center + Math.cos(angle) * maxRadius,
      y: center + Math.sin(angle) * maxRadius,
      labelX: center + Math.cos(angle) * (maxRadius + 34),
      labelY: center + Math.sin(angle) * (maxRadius + 34),
    };
  });
  const points = values
    .map((value, index) => {
      const angle = (Math.PI * 2 * index) / labels.length - Math.PI / 2;
      const radius = maxRadius * (value / 100);
      return `${center + Math.cos(angle) * radius},${center + Math.sin(angle) * radius}`;
    })
    .join(" ");

  return (
    <article className="rounded-2xl bg-white p-5 shadow-[0_10px_24px_rgba(15,23,42,0.045)] ring-1 ring-border/70">
      <div className="mb-2 flex justify-end gap-5 text-xs font-semibold text-slate-500">
        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-slate-400" />其他标签</span>
        <span className="inline-flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-primary" />个性标签</span>
      </div>
      <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto h-[360px] w-full max-w-[430px]">
        {[0.25, 0.5, 0.75, 1].map((scale) => {
          const ring = axis
            .map((_, index) => {
              const angle = (Math.PI * 2 * index) / labels.length - Math.PI / 2;
              return `${center + Math.cos(angle) * maxRadius * scale},${center + Math.sin(angle) * maxRadius * scale}`;
            })
            .join(" ");
          return <polygon key={scale} points={ring} fill="none" stroke="#e5e7eb" strokeDasharray="4 5" />;
        })}
        {axis.map((point) => (
          <line key={point.label} x1={center} y1={center} x2={point.x} y2={point.y} stroke="#eef0f5" />
        ))}
        <polygon points={points} fill="color-mix(in oklch, var(--primary) 18%, transparent)" stroke="var(--primary)" strokeWidth="3" />
        {points.split(" ").map((point, index) => {
          const [x, y] = point.split(",").map(Number);
          return <circle key={`${point}-${index}`} cx={x} cy={y} r="5" fill="#fff" stroke="var(--primary)" strokeWidth="3" />;
        })}
        {axis.map((point) => (
          <text key={point.label} x={point.labelX} y={point.labelY} textAnchor="middle" dominantBaseline="middle" className="fill-slate-400 text-[13px] font-bold">
            {point.label}
          </text>
        ))}
      </svg>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl bg-primary-soft px-4 py-3 text-sm font-black text-primary">优秀项（4+）</div>
        <div className="rounded-xl bg-primary-soft/70 px-4 py-3 text-sm font-black text-accent-foreground">待加强项（B+/B-）</div>
      </div>
    </article>
  );
}

function KpiSummaryCard({
  title,
  value,
  details,
  warning = false,
}: {
  title: string;
  value: string;
  details?: Array<{ label: string; value: string }>;
  warning?: boolean;
}) {
  return (
    <article className="relative overflow-hidden rounded-2xl bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)] ring-1 ring-border/70">
      <div className="pointer-events-none absolute right-0 top-0 h-16 w-16 rounded-bl-[42px] bg-primary-soft" />
      <div className="flex items-center gap-2">
        {warning ? <AlertCircle className="h-5 w-5 text-primary" /> : <Target className="h-5 w-5 text-primary" />}
        <p className="text-base font-black text-slate-500">{title}</p>
      </div>
      <div className="mt-5 flex flex-wrap items-end gap-x-8 gap-y-2">
        <strong className="text-4xl font-black tracking-tight text-slate-800">{value}</strong>
        {details?.map((item) => (
          <div key={item.label}>
            <p className="text-xs font-bold text-slate-400">{item.label}</p>
            <p className="mt-1 text-2xl font-black text-slate-700">{item.value}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function OrgBlueprint({ top, units, compact }: { top: OrgUnit; units: OrgUnit[]; compact: boolean }) {
  const gridClass = compact ? "grid-cols-8" : units.length <= 5 ? "grid-cols-5" : "grid-cols-7";

  return (
    <div className="overflow-x-auto pb-2">
      <div className={`${compact ? "min-w-[900px]" : "min-w-[1320px]"} relative px-4 py-4`}>
        <div className="mx-auto w-[310px]">
          <OrgUnitCard unit={top} featured />
        </div>
        <div className="mx-auto h-10 w-px bg-primary/20" />
        <div className="relative">
          <div className="absolute left-[8%] right-[8%] top-0 h-8 rounded-t-xl border-x border-t border-primary/20" />
          <div className={`relative grid gap-4 pt-8 ${gridClass}`}>
            {units.map((unit) => (
              <div key={unit.name} className="relative">
                <span className="absolute left-1/2 top-[-32px] h-8 w-px -translate-x-1/2 bg-primary/20" />
                <OrgUnitCard unit={unit} vertical={compact} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function OrgUnitCard({ unit, featured = false, vertical = false }: { unit: OrgUnit; featured?: boolean; vertical?: boolean }) {
  return (
    <article className={`relative rounded-xl border border-primary/10 bg-white shadow-[0_10px_24px_rgba(15,23,42,0.045)] ${featured ? "p-4" : "p-3"}`}>
      {unit.owner && (
        <span className="absolute right-3 top-3 max-w-[72px] truncate rounded-md border border-primary/20 bg-white px-2 py-1 text-[11px] font-black text-primary shadow-sm">
          {unit.owner}
        </span>
      )}
      <div className="mb-2 flex items-start justify-between gap-2 pr-16">
        <div className="min-w-0">
          <p className={`truncate font-black text-slate-700 ${vertical ? "text-[12px] leading-4" : "text-sm"}`}>{unit.name}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-1 border-b border-primary/10 pb-2 text-center">
        <OrgMiniStat label="成本(亿)" value={unit.budget} />
        <OrgMiniStat label="编制(人)" value={unit.active} emphasis />
        <OrgMiniStat label="职数(人)" value={unit.posts} hot />
      </div>
      <div className="mt-2 grid grid-cols-3 gap-1 text-center">
        <OrgMiniStat label="高层" value={unit.levels[0]} />
        <OrgMiniStat label="中层" value={unit.levels[1]} />
        <OrgMiniStat label="基层" value={unit.levels[2]} hot />
      </div>
    </article>
  );
}

function OrgMiniStat({ label, value, emphasis = false, hot = false }: { label: string; value: string; emphasis?: boolean; hot?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-slate-400">{label}</p>
      <p className={`mt-0.5 text-sm font-black ${hot ? "text-primary" : emphasis ? "text-slate-800" : "text-slate-600"}`}>{value}</p>
    </div>
  );
}

function OrgTotalMetricCard({ card }: { card: OrgTotalCard }) {
  return (
    <article className="rounded-xl bg-white p-4 shadow-[0_8px_18px_rgba(15,23,42,0.035)] ring-1 ring-border/70">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-black text-slate-700">{card.title}</p>
        <p className="text-lg font-black text-slate-800">{card.total}</p>
      </div>
      {card.rows.length > 0 ? (
        <div className="grid grid-cols-3 gap-2">
          {card.rows.map(([label, value]) => (
            <div key={label} className="rounded-lg bg-slate-50 px-2 py-2 text-center">
              <p className="text-[10px] font-bold text-slate-400">{label}</p>
              <p className="mt-1 text-sm font-black text-slate-700">{value}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg bg-slate-50 px-3 py-6 text-center text-xs font-semibold text-slate-400">-</div>
      )}
      {card.extra && (
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
          {card.extra.map(([label, value]) => (
            <div key={label} className="text-center">
              <p className="text-[10px] font-bold text-slate-400">{label}</p>
              <p className="mt-1 text-sm font-black text-slate-700">{value}</p>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function OrgVitalityPanel() {
  const rows = [
    {
      dimension: "人才梯队质量",
      rating: 4,
      items: [
        { name: "干部平均年龄", measure: "衡量对应群体人员年龄的平均水平", current: "46.4", average: "47.1", label: "黄灯" as const },
        { name: "复合经历占比", measure: "衡量对应群体中，拥有双跨及以上经历人员的占比情况", current: "91%", average: "65%", label: "绿灯" as const },
        { name: "绩优占比", measure: "衡量对应群体中，连续两年绩效表现处于前40%人员的占比情况", current: "28%", average: "27.4%", label: "黄灯" as const },
        { name: "潜才储备率", measure: "衡量在岗干部中，纳入潜才池人员的占比情况", current: "13%", average: "10%", label: "绿灯" as const },
      ],
    },
    {
      dimension: "队伍新陈代谢",
      rating: 2,
      items: [
        { name: "新进干部均龄", measure: "衡量对应群体人员年龄的平均水平", current: "38.9", average: "40.6", label: "绿灯" as const },
        { name: "老化干部占比", measure: "衡量在岗人员中，经多维度综合判定为老化干部人员的占比情况", current: "3.1%", average: "2.8%", label: "黄灯" as const },
        { name: "干部流动率", measure: "衡量组织内人员流动的频率和占比情况", current: "15%", average: "8%", label: "绿灯" as const },
        { name: "主动淘汰率", measure: "衡量组织内，主动退出/淘汰人员的占比情况", current: "3.0%", average: "3.0%", label: "黄灯" as const },
      ],
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-[0_12px_28px_rgba(15,23,42,0.05)] ring-1 ring-border/70">
        <div className="flex items-center justify-between gap-4">
          <PrototypeTitle title="组织活力评估" />
          <span className="text-sm font-bold text-muted-foreground">数据截止日期：2026年3月24日</span>
        </div>
        <div className="relative mt-5 overflow-hidden rounded-xl border border-primary/10 bg-primary-soft/55 p-5">
          <Sparkles className="pointer-events-none absolute right-4 top-2 h-36 w-36 text-primary/10" strokeWidth={1.7} />
          <div className="relative z-10 space-y-4 text-sm leading-relaxed text-foreground">
            <p className="text-base font-black">
              组织整体干部流动较快、复合人才充足，但缺乏覆盖“应届生→基层→中层”全职业生命周期的系统性、进阶式培养机制，导致人才发展后劲不足，难以充分释放现有梯队潜力并支撑未来战略需求
            </p>
            <VitalityBullet
              title="人才梯队质量：复合型干部储备充足，潜力人才池相对充盈，但年轻、绩优人才仍需突破"
              pros="复合干部超9成，显著优于集团均值，且潜才储率备13%，相对充足"
              cons="中层平均年龄46.4，不够年轻；绩优干部占比仍待提升"
            />
            <VitalityBullet
              title="队伍新陈代谢：中层注入年轻血液，流动率支撑队伍更新，但主动淘汰机制薄弱"
              pros="新进中层平均38.9岁，优于集团均值，干部流动相对快具备一定队伍更新能力"
              cons="主动淘汰力度不足，对绩差/老化人员的汰换比例不够"
            />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl bg-white shadow-[0_12px_28px_rgba(15,23,42,0.05)] ring-1 ring-border/70">
        <div className="border-b border-border px-6 py-5">
          <h3 className="text-lg font-black text-foreground">指标详情</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black text-slate-500">
              <tr>
                {["评估维度", "评估指标", "衡量方式", "当前数据", "对比平均", "指标状态"].map((head) => (
                  <th key={head} className="px-5 py-4">{head}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((group) => (
                group.items.map((item, index) => (
                  <tr key={`${group.dimension}-${item.name}`} className="border-t border-slate-100">
                    {index === 0 && (
                      <td rowSpan={group.items.length} className="w-44 bg-white px-5 py-5 align-top">
                        <p className="font-black text-slate-700">{group.dimension}</p>
                        <div className="mt-4 flex gap-1">
                          {Array.from({ length: 5 }).map((_, starIndex) => (
                            <Star
                              key={starIndex}
                              className={`h-4 w-4 ${starIndex < group.rating ? "fill-warning text-warning" : "fill-slate-100 text-slate-200"}`}
                            />
                          ))}
                        </div>
                      </td>
                    )}
                    <td className="px-5 py-4 font-black text-slate-700">{item.name}</td>
                    <td className="px-5 py-4 text-slate-500">{item.measure}</td>
                    <td className="px-5 py-4 text-right font-black text-slate-800">{item.current}</td>
                    <td className="px-5 py-4 text-right font-semibold text-slate-500">{item.average}</td>
                    <td className="px-5 py-4">
                      <VitalityStatusDot label={item.label} />
                    </td>
                  </tr>
                ))
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function VitalityBullet({ title, pros, cons }: { title: string; pros: string; cons: string }) {
  return (
    <div className="space-y-2">
      <p className="flex gap-2 font-black">
        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
        <span>{title}</span>
      </p>
      <p className="pl-5">
        <span className="font-black text-success">亮点：</span>{pros}
      </p>
      <p className="pl-5">
        <span className="font-black text-warning">不足：</span>{cons}
      </p>
    </div>
  );
}

function VitalityStatusDot({ label }: { label: "绿灯" | "黄灯" | "红灯" }) {
  const status = label === "绿灯" ? "good" : label === "黄灯" ? "warning" : "risk";
  const cls =
    status === "good"
      ? "bg-success shadow-[0_0_0_5px_rgba(16,185,129,0.12)]"
      : status === "warning"
        ? "bg-warning shadow-[0_0_0_5px_rgba(245,158,11,0.13)]"
        : "bg-rose-500 shadow-[0_0_0_5px_rgba(244,63,94,0.13)]";
  const badgeCls =
    status === "good"
      ? "bg-success-soft text-success"
      : status === "warning"
        ? "bg-warning-soft text-warning"
        : "bg-rose-50 text-rose-600";
  return (
    <span className="inline-flex items-center gap-3">
      <span className={`inline-flex h-3.5 w-3.5 rounded-full ${cls}`} />
      <span className={`rounded-md px-2.5 py-1 text-xs font-black ${badgeCls}`}>{label}</span>
    </span>
  );
}
const RANK_AXIS = [
  { label: "后10%", x: 90 },
  { label: "后30%", x: 250 },
  { label: "前70%", x: 410 },
  { label: "前40%", x: 570 },
  { label: "前20%", x: 730 },
  { label: "前10%", x: 890 },
];

const RANK_TRAJECTORY = [
  { id: "2022-end", period: "2022年底", x: 90, y: 216, rank: "后10%", ability: "基本胜任", trend: "→" },
  { id: "2022-mid", period: "2022年中", x: 410, y: 54, rank: "前70%", ability: "超越胜任", trend: "↑" },
  { id: "2018-end", period: "2018年底", x: 410, y: 118, rank: "前70%", ability: "完全胜任", trend: "↑" },
  { id: "2019-mid", period: "2019年中", x: 410, y: 150, rank: "前70%", ability: "完全胜任", trend: "↑" },
  { id: "2019-end", period: "2019年底", x: 410, y: 184, rank: "前70%", ability: "基本胜任", trend: "↑" },
  { id: "2020-mid", period: "2020年中", x: 570, y: 122, rank: "前40%", ability: "完全胜任", trend: "↑" },
  { id: "2020-end", period: "2020年底", x: 570, y: 158, rank: "前40%", ability: "完全胜任", trend: "↑" },
  { id: "2025-end", period: "2025年底", x: 570, y: 190, rank: "前40%", ability: "基本胜任", trend: "↑" },
  { id: "2021-mid", period: "2021年中", x: 730, y: 54, rank: "前20%", ability: "超越胜任", trend: "↑" },
  { id: "2021-end", period: "2021年底", x: 730, y: 88, rank: "前20%", ability: "超越胜任", trend: "↑" },
];

const RANK_LINES = [
  ["2022-end", "2022-mid"],
  ["2022-end", "2025-end"],
  ["2019-end", "2025-end"],
  ["2019-end", "2020-mid"],
  ["2020-end", "2021-mid"],
  ["2021-end", "2021-mid"],
] as const;

const RANK_HISTORY = [
  { period: "2025年底", rank: "前40%", ability: "基本胜任", trend: "↑" },
  { period: "2022年底", rank: "后10%", ability: "基本胜任", trend: "→" },
  { period: "2022年中", rank: "前70%", ability: "超越胜任", trend: "↑" },
  { period: "2021年底", rank: "前20%", ability: "超越胜任", trend: "↑" },
  { period: "2021年中", rank: "前20%", ability: "超越胜任", trend: "↑" },
  { period: "2020年底", rank: "前40%", ability: "完全胜任", trend: "↑" },
  { period: "2020年中", rank: "前40%", ability: "完全胜任", trend: "↑" },
];

function RankingPanel({ sub }: { sub: Subordinate }) {
  const pointById = Object.fromEntries(RANK_TRAJECTORY.map((point) => [point.id, point]));
  const rankGroup = "产险公司经营管理排名组";

  return (
    <div className="space-y-5">
      <section className="bg-white">
        <div className="mb-3 text-sm font-semibold text-slate-700">综合能力</div>
        <div className="overflow-hidden">
          <div className="w-full">
            <div className="grid grid-cols-[92px_minmax(0,1fr)]">
              <div className="flex h-9 items-center justify-center bg-[#f6f8fa] text-xs font-semibold text-slate-500">管理区</div>
              <div className="flex h-9 items-center bg-[#f6f8fa] px-2 text-xs font-semibold text-slate-600">重点培养：无</div>

              <div className="grid h-[292px] grid-rows-4 bg-[#f8f8fc] text-xs font-semibold text-slate-500">
                {["超越胜任", "完全胜任", "基本胜任", "继续观察"].map((label) => (
                  <div key={label} className="flex items-center justify-center border-b border-slate-100 last:border-b-0">
                    {label}
                  </div>
                ))}
              </div>

              <div className="relative h-[292px] overflow-visible bg-white">
                <svg viewBox="0 0 980 292" preserveAspectRatio="none" className="h-full w-full overflow-visible">
                  {[0, 73, 146, 219, 292].map((y) => (
                    <line key={`h-${y}`} x1="0" x2="980" y1={y} y2={y} stroke="#eef0f5" strokeWidth="1" />
                  ))}
                  {RANK_AXIS.map((item) => (
                    <line key={`v-${item.label}`} x1={item.x} x2={item.x} y1="0" y2="292" stroke="#eef0f5" strokeWidth="1" />
                  ))}
                  {RANK_LINES.map(([fromId, toId]) => {
                    const from = pointById[fromId];
                    const to = pointById[toId];
                    return (
                      <line
                        key={`${fromId}-${toId}`}
                        x1={from.x}
                        y1={from.y}
                        x2={to.x}
                        y2={to.y}
                        stroke="#4b5563"
                        strokeOpacity="0.32"
                        strokeWidth="2"
                      />
                    );
                  })}
                  {RANK_TRAJECTORY.map((point) => (
                    <g key={point.id}>
                      <circle cx={point.x} cy={point.y} r="4.8" fill="#1d4ed8" />
                      <path d={`M ${point.x} ${point.y - 13} l -4 8 h 8 z`} fill="#1d4ed8" opacity="0.82" />
                    </g>
                  ))}
                </svg>
                {RANK_TRAJECTORY.map((point) => (
                  <div
                    key={`${point.id}-label`}
                    className="pointer-events-none absolute -translate-x-1/2 text-center text-[11px] font-semibold leading-none text-slate-500"
                    style={{ left: `${(point.x / 980) * 100}%`, top: `${point.y + 10}px` }}
                  >
                    {point.period}
                  </div>
                ))}
              </div>

              <div className="flex h-9 items-center justify-center bg-[#f4f6f8] text-xs font-semibold text-slate-500">管理区</div>
              <div className="flex h-9 items-center bg-[#f4f6f8] px-2 text-xs font-semibold text-slate-600">准备退出：无</div>

              <div />
              <div className="relative h-10">
                {RANK_AXIS.map((item) => (
                  <div
                    key={`axis-${item.label}`}
                    className="absolute top-4 -translate-x-1/2 text-[11px] font-semibold text-slate-400"
                    style={{ left: `${(item.x / 980) * 100}%` }}
                  >
                    {item.label}
                  </div>
                ))}
                <div className="absolute right-0 top-1 text-xs font-semibold text-slate-400">业绩排名</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white pt-2">
        <div className="divide-y divide-slate-100">
          {RANK_HISTORY.map((item) => (
            <div key={item.period} className="grid grid-cols-[160px_minmax(0,1fr)_24px] items-center gap-5 py-3.5 text-sm">
              <div className="flex items-center gap-3 text-slate-500">
                <span className="h-1.5 w-1.5 rounded-full border border-slate-300 bg-white" />
                <span className="font-semibold">{item.period}</span>
              </div>
              <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-1 text-slate-500">
                <span>
                  业绩排名：
                  <b className="font-semibold text-slate-600">{item.rank}</b>
                </span>
                <span className="h-4 w-px bg-slate-200" />
                <span>
                  综合能力：
                  <b className="font-semibold text-slate-600">{item.ability}</b>
                  <span className={`ml-2 text-base font-semibold ${item.trend === "↑" ? "text-slate-600" : "text-slate-400"}`}>
                    {item.trend}
                  </span>
                </span>
                <span className="h-4 w-px bg-slate-200" />
                <span>管理区：-</span>
                <span className="h-4 w-px bg-slate-200" />
                <span className="min-w-0 flex-1 truncate">排名组：{rankGroup}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-slate-300" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ArchivePanel({ sub }: { sub: Subordinate }) {
  const [tab, setTab] = useState<"overview" | "basic" | "contract" | "experience" | "performance">("overview");
  const archiveTabs = [
    { key: "overview" as const, label: "概览" },
    { key: "basic" as const, label: "基本信息" },
    { key: "contract" as const, label: "合同信息" },
    { key: "experience" as const, label: "任职经历" },
    { key: "performance" as const, label: "绩效" },
  ];

  return (
    <div className="space-y-5">
      <section className="rounded-2xl bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.05)] ring-1 ring-border/70">
        <div className="flex items-start gap-5">
          <div className="flex flex-col items-center">
            <div className="flex h-24 w-24 items-center justify-center rounded-full bg-primary-soft text-4xl font-bold text-primary">
              {sub.initial}
            </div>
            <span className="mt-[-8px] rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">
              证件资料 ›
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h3 className="text-2xl font-bold">{sub.name}</h3>
              <span className="rounded-full bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">{sub.type === "direct" ? "直接下属" : "间接下属"}</span>
            </div>
            <p className="mt-2 text-sm font-semibold text-muted-foreground">{sub.id.padStart(6, "0")}</p>
            <p className="mt-2 text-sm text-foreground">产险公司 · {getSubDepartment(sub)} / {sub.title}</p>
          </div>
        </div>
        <div className="mt-5 grid grid-cols-5 border-t border-border pt-4 text-center">
          {[
            ["角色", sub.type === "direct" ? "直接" : "间接"],
            ["周期", CURRENT_PERIOD],
            ["状态", sub.status === "pending_feedback" ? "待反馈" : sub.status === "confirmed" ? "已确认" : "未提交"],
            ["评分", String(sub.score ?? "—")],
            ["来源", "示例数据"],
          ].map(([label, value]) => (
            <div key={label}>
              <p className="text-xs font-semibold text-muted-foreground">{label}</p>
              <p className="mt-1 text-lg font-bold">{value}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-[0_12px_28px_rgba(15,23,42,0.05)] ring-1 ring-border/70">
        <div className="flex items-center justify-between">
          <SectionTitle title="个人简介" />
          <span className="rounded-full bg-primary-soft px-3 py-1 text-xs font-semibold text-primary">AI 整理</span>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-foreground">
          {sub.name}，现任{sub.title}，当前汇报关系属于{CURRENT_USER.name}组织架构。
        </p>
        <div className="mt-4 grid gap-2 text-sm">
          <ArchiveTags label="基础" tags={["产险管理", "经营干部"]} />
          <ArchiveTags label="绩效" tags={["2026年4月绩效追踪", "组织架构样例数据"]} />
          <ArchiveTags label="经历" tags={["产险业务", "经营管理"]} />
          <ArchiveTags label="来源" tags={["龙泉下属名单"]} />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl bg-white shadow-[0_12px_28px_rgba(15,23,42,0.05)] ring-1 ring-border/70">
        <div className="flex h-14 items-end gap-6 border-b border-border px-5">
          {archiveTabs.map((item) => {
            const active = tab === item.key;
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`relative h-14 px-1 text-sm font-semibold transition ${
                  active ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {item.label}
                <span className={`absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-primary transition ${active ? "opacity-100" : "opacity-0"}`} />
              </button>
            );
          })}
        </div>
        <div className="p-5">
          {tab === "overview" && <ArchiveOverview />}
          {tab === "basic" && <ArchiveBasic sub={sub} />}
          {tab === "contract" && <ArchiveContract />}
          {tab === "experience" && <ArchiveExperience />}
          {tab === "performance" && <ArchivePerformance />}
        </div>
      </section>
    </div>
  );
}

function SectionTitle({ title, badge }: { title: string; badge?: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="h-5 w-1 rounded-full bg-primary/70" />
      <h3 className="text-lg font-bold">{title}</h3>
      {badge && <span className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold text-muted-foreground">{badge}</span>}
    </div>
  );
}

function InfoLine({ label, value, valueClass = "" }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className={`text-right font-semibold ${valueClass}`}>{value}</span>
    </div>
  );
}

function ArchiveTags({ label, tags }: { label: string; tags: string[] }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-10 shrink-0 font-semibold text-muted-foreground">{label}</span>
      <div className="flex flex-wrap gap-2">
        {tags.map((tag) => (
          <span key={tag} className="rounded-md bg-primary-soft px-2.5 py-1 text-xs font-semibold text-primary">{tag}</span>
        ))}
      </div>
    </div>
  );
}

function ArchiveOverview() {
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <SectionTitle title="个人信息" />
        <button className="text-xs font-semibold text-muted-foreground hover:text-primary">查看更多 ›</button>
      </div>
      <ArchiveRows rows={[
        ["所属公司", "产险公司"],
        ["当前周期", CURRENT_PERIOD],
        ["岗位", "产险管理干部"],
        ["汇报关系", CURRENT_USER.name],
        ["数据来源", "龙泉的下属名单"],
      ]} />
    </div>
  );
}

function ArchiveBasic({ sub }: { sub: Subordinate }) {
  return (
    <div>
      <SectionTitle title="基本信息" />
      <ArchiveRows rows={[
        ["姓名", sub.name],
        ["工号", sub.id.padStart(6, "0")],
        ["所属公司", "产险公司"],
        ["部门", getSubDepartment(sub)],
        ["岗位", sub.title],
        ["汇报关系", CURRENT_USER.name],
      ]} />
    </div>
  );
}

function ArchiveContract() {
  return (
    <div>
      <SectionTitle title="合同信息" />
      <ArchiveRows rows={[
        ["签约公司", "产险公司"],
        ["合同类型", "管理干部"],
        ["合同开始", "—"],
        ["合同结束", "—"],
        ["数据来源", "龙泉的下属名单"],
      ]} />
    </div>
  );
}

function ArchiveExperience() {
  return (
    <div className="space-y-7">
      <div>
        <SectionTitle title="教育经历" />
        <ExperienceRow time="—" title="教育经历" desc="样例数据未提供" />
      </div>
      <div>
        <SectionTitle title="工作经历" />
        <ExperienceRow time="当前" title="产险公司" desc="产险经营管理岗位" />
      </div>
    </div>
  );
}

function ArchivePerformance() {
  return (
    <div>
      <SectionTitle title="绩效摘要" />
      <ArchiveRows rows={[
        ["最近考核", `${CURRENT_PERIOD} · 月度追踪`],
        ["所在排名组", "产险公司经营管理排名组"],
        ["排名组人数", "57"],
        ["近三年趋势", "样例数据未提供"],
      ]} />
    </div>
  );
}

function ArchiveRows({ rows }: { rows: [string, string][] }) {
  return (
    <div className="mt-5 divide-y divide-border/70">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-center justify-between gap-6 py-3 text-sm">
          <span className="text-muted-foreground">{label}</span>
          <span className="text-right font-semibold">{value}</span>
        </div>
      ))}
    </div>
  );
}

function ExperienceRow({ time, title, desc }: { time: string; title: string; desc: string }) {
  return (
    <div className="grid grid-cols-[140px_minmax(0,1fr)] border-b border-border/70 py-3 text-sm last:border-0">
      <span className="font-medium text-muted-foreground">{time}</span>
      <div>
        <p className="font-bold">{title}</p>
        <p className="mt-0.5 text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

function CollapsiblePanel({
  title,
  badge,
  open,
  onToggle,
  children,
}: {
  title: string;
  badge?: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl bg-white overflow-hidden shadow-[0_16px_36px_rgba(15,23,42,0.06)] ring-1 ring-border/80">
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-secondary/45 transition"
      >
        <span className="h-8 w-8 rounded-xl bg-primary-soft text-accent-foreground flex items-center justify-center text-xs font-bold shadow-inner">
          {title.slice(0, 2)}
        </span>
        <span className="text-sm font-semibold">{title}</span>
        {badge && (
          <span className="text-[10px] font-medium px-2 py-1 rounded-full bg-secondary/70 text-muted-foreground">
            {badge}
          </span>
        )}
        <ChevronDown className={`h-4 w-4 ml-auto text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && <div className="px-5 pb-5">{children}</div>}
    </section>
  );
}

function PerformanceMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone: "primary" | "success" | "warning";
}) {
  const toneCls = {
    primary: "bg-primary-soft text-accent-foreground",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
  };
  return (
    <div className="rounded-xl border border-border bg-secondary/40 p-3">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={`mt-1 inline-flex rounded-md px-2 py-0.5 text-lg font-bold ${toneCls[tone]}`}>{value}</p>
    </div>
  );
}

function SupervisorFeedbackCard({
  sub,
  submittedFeedback,
  period,
  feedback,
  hasFeedback,
  open,
  onToggle,
}: {
  sub: Subordinate;
  submittedFeedback?: SubmittedFeedback;
  period: string;
  feedback: SubmittedFeedback;
  hasFeedback: boolean;
  open: boolean;
  onToggle: () => void;
}) {
  const score = feedback.score;
  const submittedTime = feedback.submittedAt
    ? new Date(feedback.submittedAt).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
    : null;
  void submittedFeedback;
  return (
    <section className="relative overflow-hidden rounded-2xl bg-[linear-gradient(110deg,#ffffff_0%,var(--secondary)_58%,#ffffff_100%)] shadow-[0_18px_42px_rgba(15,23,42,0.07)] ring-1 ring-border/80">
      <div className="pointer-events-none absolute -right-6 top-0 h-40 w-72 opacity-95">
        <div
          className="absolute right-0 top-0 h-36 w-60 bg-[linear-gradient(135deg,rgba(134,144,156,0.16),rgba(255,255,255,0.24))]"
          style={{ clipPath: "polygon(22% 0, 100% 0, 100% 100%, 52% 72%)" }}
        />
        <div
          className="absolute right-8 top-6 h-28 w-52 bg-[linear-gradient(135deg,rgba(199,204,214,0.22),rgba(255,255,255,0.18))]"
          style={{ clipPath: "polygon(36% 0, 100% 0, 78% 100%, 0 42%)" }}
        />
        <div
          className="absolute right-20 top-12 h-24 w-44 bg-white/40"
          style={{ clipPath: "polygon(50% 0, 100% 28%, 60% 100%, 0 38%)" }}
        />
      </div>
      <div className="relative z-10 flex items-center justify-between gap-3">
        <button
          onClick={onToggle}
          className="flex-1 px-5 py-4 flex items-center gap-3 text-left hover:bg-white/35 transition"
        >
          <span className="h-8 w-8 rounded-xl bg-white/75 text-accent-foreground flex items-center justify-center text-xs font-bold shadow-inner ring-1 ring-primary-soft">
            上级
          </span>
          <span className="text-base font-semibold">上级反馈</span>
          <span className="rounded-full bg-white/75 px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{period}</span>
          <ChevronDown className={`h-4 w-4 ml-auto text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
        </button>
      </div>
      {open && (
        <div className="relative z-10 px-5 pb-5">
          {hasFeedback ? (
            <>
              <div className="max-w-[64%] pb-5">
                <p className="text-sm leading-relaxed text-foreground">
                  {CURRENT_USER.name} · {period}{submittedTime ? ` · ${submittedTime} 已同步` : ""}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-0 overflow-hidden rounded-2xl border border-white/75 bg-white/72 shadow-[0_12px_28px_rgba(15,23,42,0.05)] backdrop-blur-md lg:grid-cols-[112px_minmax(0,1.25fr)_minmax(0,1.25fr)_minmax(0,1.35fr)]">
                <FeedbackMetric label="评分" value={`${score}分`} muted="综合评价" />
                <FeedbackMetric label="工作亮点" value={feedback.highlights} color="success" />
                <FeedbackMetric label="存在不足" value={feedback.shortcomings} color="warning" />
                <FeedbackMetric label="下月重点" value={feedback.nextFocus} color="primary" />
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-primary/20 bg-white/72 px-4 py-8 text-center shadow-[0_12px_28px_rgba(15,23,42,0.04)]">
              <p className="text-sm font-black text-foreground">暂无上级反馈</p>
              <p className="mt-2 text-xs font-semibold text-muted-foreground">主考完成反馈后将在这里同步展示。</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function FeedbackMetric({
  label,
  value,
  muted,
  color = "primary",
}: {
  label: string;
  value: string;
  muted?: string;
  color?: "success" | "warning" | "primary";
}) {
  const dotMap = {
    success: "bg-success",
    warning: "bg-warning",
    primary: "bg-primary",
  };
  return (
    <div className="min-h-[112px] border-b border-primary-soft/70 px-4 py-3.5 last:border-b-0 lg:border-b-0 lg:border-r lg:last:border-r-0">
      <p className="flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
        <span className={`h-1.5 w-1.5 rounded-full ${dotMap[color]}`} />
        {label}
      </p>
      <p className={`${label === "评分" ? "mt-2 text-2xl font-bold text-accent-foreground" : "mt-2 text-xs leading-relaxed text-foreground"}`}>
        {value}
      </p>
      {muted && <p className="mt-1 text-[11px] text-muted-foreground">{muted}</p>}
    </div>
  );
}

function MonthlyReportSummaryCard({
  sub,
  period,
  report,
  hasReport,
  open,
  onToggle,
  showGoalPreview = false,
}: {
  sub: Subordinate;
  period: string;
  report: SubMonthlyReportRecord;
  hasReport: boolean;
  open: boolean;
  onToggle: () => void;
  showGoalPreview?: boolean;
}) {
  const [showOriginalReport, setShowOriginalReport] = useState(false);
  const monthLabel = `${Number(period.split("-")[1] ?? 0)}月月度汇报`;
  void sub;

  return (
    <section className="rounded-2xl bg-white overflow-hidden shadow-[0_16px_36px_rgba(15,23,42,0.06)] ring-1 ring-border/80">
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-secondary/45 transition"
      >
        <span className="h-8 w-8 rounded-xl bg-primary-soft text-accent-foreground flex items-center justify-center text-xs font-bold shadow-inner">
          月报
        </span>
        <span className="text-sm font-semibold">{monthLabel}</span>
        <span className="text-[11px] text-muted-foreground">{period}</span>
        <ChevronDown className={`h-4 w-4 ml-auto text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>

      {open && (
        <div className="space-y-4 px-5 pb-5">
          {hasReport && (
          <div>
            <div className="mb-3 flex items-center gap-2">
              <span className="text-sm font-bold">综合汇报</span>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">{period}</span>
              <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-primary">AI 整理</span>
              <button
                type="button"
                onClick={() => setShowOriginalReport((v) => !v)}
                className="ml-auto rounded-lg border border-primary/25 bg-white px-2.5 py-1 text-xs font-semibold text-primary transition hover:bg-primary-soft"
              >
                {showOriginalReport ? "查看 AI 整理" : "查看原文"}
              </button>
            </div>
            <div className="rounded-2xl bg-secondary/30 px-4 py-3.5 shadow-[0_8px_18px_rgba(15,23,42,0.035)]">
              {showOriginalReport ? (
                <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">{report.original}</p>
              ) : (
                <div className="space-y-2 text-sm leading-relaxed text-foreground">
                  <p><span className="font-semibold text-success">亮点：</span>{report.highlights}</p>
                  <p><span className="font-semibold text-warning">不足：</span>{report.shortcomings}</p>
                  <p><span className="font-semibold text-primary">下月计划：</span>{report.nextFocus}</p>
                </div>
              )}
            </div>
          </div>
          )}

          <MonthlyMetricGroup title="核心 KPI" count={SUB_KPIS.length} items={SUB_KPIS} kind="kpi" showGoalPreview={showGoalPreview || !hasReport} showScores={hasReport} showSelfReview={hasReport} />
          <MonthlyMetricGroup title="关键工作" count={SUB_KEY_WORK.length} items={SUB_KEY_WORK} kind="work" showGoalPreview={showGoalPreview || !hasReport} showScores={hasReport} showSelfReview={hasReport} />
        </div>
      )}
    </section>
  );
}

function MonthlyMetricGroup({
  title,
  count,
  items,
  kind,
  showGoalPreview = false,
  showScores = true,
  showSelfReview = true,
}: {
  title: string;
  count: number;
  items: MonthlyMetricItem[];
  kind: "kpi" | "work";
  showGoalPreview?: boolean;
  showScores?: boolean;
  showSelfReview?: boolean;
}) {
  return (
    <div>
      <div className="mb-3 flex items-center gap-2 border-b border-dashed border-border pb-3">
        <span className="text-base font-bold text-foreground">{title}</span>
        <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{count} 项</span>
      </div>
      <div className="space-y-3">
        {items.map((item) => (
          <MonthlyMetricRow
            key={item.title}
            item={item}
            kind={kind}
            showGoalPreview={showGoalPreview}
            showScores={showScores}
            showSelfReview={showSelfReview}
          />
        ))}
      </div>
    </div>
  );
}

function MonthlyMetricRow({
  item,
  kind,
  showGoalPreview = false,
  showScores = true,
  showSelfReview = true,
}: {
  item: MonthlyMetricItem;
  kind: "kpi" | "work";
  showGoalPreview?: boolean;
  showScores?: boolean;
  showSelfReview?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const metricValues = kind === "kpi"
    ? [
        { label: "权重", value: item.weight },
        { label: "自评分", value: showScores ? item.self : "", emphasis: true },
        { label: "主考评分", value: showScores ? item.last : "", emphasis: true },
      ]
    : [
        { label: "自评分", value: showScores ? item.self : "", emphasis: true },
        { label: "主考评分", value: showScores ? item.last : "", emphasis: true },
      ];

  return (
    <article className="group overflow-hidden rounded-2xl bg-secondary/45 px-4 py-3.5 shadow-[0_8px_18px_rgba(15,23,42,0.035)] ring-1 ring-transparent transition duration-300 hover:-translate-y-1 hover:bg-[linear-gradient(135deg,var(--secondary)_0%,#ffffff_48%,var(--secondary)_100%)] hover:shadow-[0_22px_46px_rgba(15,23,42,0.08)] hover:ring-border/90">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-start justify-between gap-4 text-left"
      >
        <div className="min-w-0 flex-1 pr-6">
          <p className="text-[15px] font-bold leading-tight text-foreground transition group-hover:text-accent-foreground">
            {item.title}
          </p>
          {showGoalPreview && (
            <p className="mt-2 line-clamp-1 text-xs font-medium leading-relaxed text-muted-foreground">
              目标：{item.goal}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-start gap-4">
          <div className={`grid gap-4 text-right ${kind === "kpi" ? "grid-cols-3" : "grid-cols-2"}`}>
            {metricValues.map((metric) => (
              <MetricValue
                key={metric.label}
                label={metric.label}
                value={metric.value}
                emphasis={metric.emphasis}
              />
            ))}
          </div>
          <span className="mt-1 flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition group-hover:bg-white/80 group-hover:text-accent-foreground group-hover:shadow-sm">
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </span>
        </div>
      </button>
      {expanded && (
        <div className="mt-4 space-y-3 border-t border-dashed border-border/90 pt-4">
          <ExpandableTextLine label="目标" text={item.goal} threshold={90} />
          {showSelfReview && <ExpandableTextLine label="月度自评" text={item.note} threshold={96} />}
        </div>
      )}
    </article>
  );
}

function MetricValue({ label, value, emphasis }: { label: string; value: string | number; emphasis?: boolean }) {
  return (
    <div className="min-w-[54px]">
      <p className="text-[10px] font-semibold text-muted-foreground">{label}</p>
      <p className={`mt-1 leading-none text-foreground ${emphasis ? "text-lg font-bold" : "text-sm font-semibold"}`}>{value}</p>
    </div>
  );
}

function ExpandableTextLine({ label, text, threshold }: { label: string; text: string; threshold: number }) {
  const [expanded, setExpanded] = useState(false);
  const canToggle = text.length > threshold;

  return (
    <div className="flex items-start gap-3 rounded-xl bg-white/68 px-3 py-2.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.75)] backdrop-blur">
      <span className="w-16 shrink-0 text-[12px] font-bold text-muted-foreground">{label}</span>
      <p className={`min-w-0 flex-1 text-[13px] leading-relaxed text-muted-foreground ${canToggle && !expanded ? "line-clamp-2" : ""}`}>
        {text}
      </p>
      {canToggle && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-label={expanded ? `收起${label}` : `展开${label}`}
          className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-white hover:text-primary"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      )}
    </div>
  );
}

function TodoItem({
  text, actionText, onAction, actionVariant = "primary",
}: { text: string; actionText: string; onAction: () => void; actionVariant?: "primary" | "soft" | "warn" }) {
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    soft: "bg-primary-soft text-accent-foreground hover:bg-primary/15",
    warn: "bg-warning text-white hover:opacity-90",
  };
  return (
    <div className="flex items-center justify-between gap-2 p-2.5 rounded-lg hover:bg-secondary/60 transition">
      <span className="text-sm flex-1">{text}</span>
      <button onClick={onAction} className={`px-3 py-1 rounded-md text-xs font-medium transition ${variants[actionVariant]}`}>
        {actionText}
      </button>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}

function Drawer({ children, onClose, title, wide, noOverlay }: { children: React.ReactNode; onClose: () => void; title: string; wide?: boolean; noOverlay?: boolean }) {
  return (
    <div className={`fixed inset-0 z-50 flex ${noOverlay ? "pointer-events-none" : ""}`}>
      {!noOverlay && (
        <div className="absolute inset-0 bg-foreground/30 backdrop-blur-sm animate-in fade-in" onClick={onClose} />
      )}
      <div
        className={`relative bg-card h-full ${wide ? "w-[560px]" : "w-[440px]"} shadow-2xl border-r border-border overflow-y-auto animate-in slide-in-from-left duration-200 ${noOverlay ? "pointer-events-auto" : ""}`}
      >
        <div className="sticky top-0 bg-card border-b border-border px-5 h-14 flex items-center justify-between z-10">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function SubordinateDetail({
  sub, onWriteFeedback, onRemind, remindCooldownMs,
}: {
  sub: Subordinate;
  onWriteFeedback: () => void;
  onRemind: () => void;
  remindCooldownMs: number;
}) {
  const submitted = sub.status !== "not_submitted" && sub.status !== "reminded";
  const reminded = sub.status === "reminded";
  const cooldownMinutes = Math.ceil(remindCooldownMs / 60000);
  const remindDisabled = reminded && remindCooldownMs > 0;
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-4">
        <Avatar initial={sub.initial} size="lg" src={getPersonAvatarUrl(sub.id, sub.name)} alt={sub.name} />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-xl font-semibold">{sub.name}</h3>
            {sub.score && <span className="text-sm font-medium text-accent-foreground bg-primary-soft px-2 py-0.5 rounded-md">{sub.score}</span>}
          </div>
          <p className="text-sm text-muted-foreground">{sub.title}</p>
        </div>
        {submitted ? (
          <button
            onClick={onWriteFeedback}
            className="px-3.5 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition flex items-center gap-1.5"
          >
            <Pencil className="h-3.5 w-3.5" /> 写反馈
          </button>
        ) : (
          <button
            onClick={onRemind}
            disabled={remindDisabled}
            className="px-3.5 py-2 rounded-lg bg-warning text-white text-sm font-medium hover:opacity-90 transition flex items-center gap-1.5 disabled:bg-muted disabled:text-muted-foreground"
          >
            <Bell className="h-3.5 w-3.5" />
            {remindDisabled ? `${cooldownMinutes}分钟后可催办` : reminded ? "再次催办" : "催办"}
          </button>
        )}
      </div>

      {reminded && (
        <div className="rounded-xl bg-warning-soft/50 border border-warning/30 p-3 text-xs text-warning flex items-center gap-2">
          <Check className="h-3.5 w-3.5" />
          催办提醒已发送给 {sub.name}
          {remindDisabled ? `，${cooldownMinutes} 分钟后可再次发送` : "，现在可再次发送"}
        </div>
      )}

      <div>
        <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
          <span className="h-1 w-4 bg-primary rounded-full" /> 下属本期工作汇报 <span className="text-xs text-muted-foreground font-normal">{CURRENT_PERIOD}</span>
        </h4>
        {submitted ? (
          <div className="grid grid-cols-3 gap-2.5">
            <div className="rounded-xl bg-success-soft/60 p-3">
              <p className="text-xs font-semibold text-success mb-1">亮点</p>
              <p className="text-xs leading-relaxed">车险、小个非、集团个金和AI应用均形成改善动作，HS项目进展符合预期</p>
            </div>
            <div className="rounded-xl bg-warning-soft/60 p-3">
              <p className="text-xs font-semibold text-warning mb-1">不足</p>
              <p className="text-xs leading-relaxed">个旧提升、HS主体集中度、个非新口径和K6组织工作仍需加强</p>
            </div>
            <div className="rounded-xl bg-primary-soft p-3">
              <p className="text-xs font-semibold text-accent-foreground mb-1">下月计划</p>
              <p className="text-xs leading-relaxed">确保车险及个非半年超市场，推进集团重点项目、HS能力建设和AI组织转型</p>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
            该下属本月尚未提交工作汇报
          </div>
        )}
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <h4 className="text-sm font-semibold flex items-center gap-2">
            <span className="h-1 w-4 bg-primary rounded-full" /> 主管反馈与评价
          </h4>
          <select className="text-xs border border-border rounded-md px-2 py-1 bg-background">
            <option>{CURRENT_PERIOD}（最新）</option>
          </select>
        </div>
        <div className="rounded-xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">综合评分</span>
            <span className="text-2xl font-bold text-primary">85</span>
          </div>
          <div className="space-y-2">
            <FeedbackItem label="工作亮点" color="success" text="个非健康险创新取得进展，智小安AI工具得到监管及行业认可" />
            <FeedbackItem label="存在不足" color="warning" text="车险及个非发展仍有问题，个全新客数达成不及预期，平台和线销模式变革较慢" />
            <FeedbackItem label="下月重点" color="primary" text="确保车险及个非半年超市场，推进集团重点项目、HS模式突破和AI组织相关工作" />
          </div>
        </div>
      </div>

      <PlanIndicators />

    </div>
  );
}

type PlanMetric = {
  code?: string;
  name: string;
  value?: string;
  method?: string;
  target?: string;
  note?: string;
};

type PlanSection = {
  title: string;
  deadline?: string;
  items: string[];
};

type PlanSourceCard = {
  title: string;
  subtitle: string;
  blocks: Array<{
    title: string;
    items: string[];
    columns?: Array<{ label: string; items: string[] }>;
  }>;
};

type PlanPhase = {
  id: "K0" | "K1" | "K2" | "K3" | "K4" | "K5" | "K6";
  title: string;
  headline: string;
  summary: string;
  accent: "blue" | "green" | "amber" | "slate";
  sourceCards: PlanSourceCard[];
  metrics: PlanMetric[];
  sections: PlanSection[];
};

const PLAN_PHASES: PlanPhase[] = [
  {
    id: "K0",
    title: "战略结果盘",
    headline: "经营稳健、净利润持续增长，为集团做持续贡献",
    summary: "承接 2026 年目标、四比规划和 2030 目标，将净利润、份额、COR、企康、综金、ROE 与偿付能力统一为一组长期经营结果。",
    accent: "blue",
    sourceCards: [
      {
        title: "K0 1/4",
        subtitle: "经营稳健，净利润持续增长，为集团做持续贡献",
        blocks: [
          { title: "K0-1 净利润", items: [], columns: [
            { label: "26年目标", items: ["***亿"] },
            { label: "规划“四比”要求", items: ["一表利润：比自己 **%；比市场增速优于市场；比标杆增速优于竞对均值。", "投资收益：比自己 **%；比市场收益率超市场；比标杆三年滚动 CII 位于同业前列。"] },
            { label: "30年目标", items: ["***亿"] },
          ] },
        ],
      },
      {
        title: "K0 2/4",
        subtitle: "份额持续提升，车险通过 H-S 挑战行业第一，非车挑战达标杆 ***%",
        blocks: [
          { title: "K0-2 整体份额（不含HS）", items: [], columns: [
            { label: "26年目标", items: ["***%¹"] },
            { label: "规划“四比”要求", items: ["比自己：2026-2030 按年跟踪 **%。", "比市场：份额持续提升。", "比标杆：提升幅度超主要竞对。"] },
            { label: "30年目标", items: ["***%"] },
          ] },
          { title: "车险份额（含HS）", items: [], columns: [
            { label: "26年目标", items: ["***%"] },
            { label: "规划“四比”要求", items: ["比自己：2026-2030 按年跟踪 **%。", "比市场：份额持续提升。", "比标杆：5年成为行业第一。"] },
            { label: "30年目标", items: ["***%"] },
          ] },
          { title: "车险份额（不含HS）", items: [], columns: [
            { label: "26年目标", items: ["***%"] },
            { label: "规划“四比”要求", items: ["比自己：2026-2030 按年跟踪 **%。", "比市场：较行业自身不低于市场增速。"] },
            { label: "30年目标", items: ["***%"] },
          ] },
          { title: "非车份额", items: [], columns: [
            { label: "26年目标", items: ["***%¹"] },
            { label: "规划“四比”要求", items: ["比自己：2026-2030 按年跟踪 **%。", "比市场：各条线份额持续提升。", "比标杆：5年内达到标杆 ***%。"] },
            { label: "30年目标", items: ["***%"] },
          ] },
        ],
      },
      {
        title: "K0 3/4",
        subtitle: "整体及条线品质优于市场水平，并挑战优于主要竞争对手",
        blocks: [
          { title: "K0-3 COR", items: [], columns: [
            { label: "26年目标", items: ["***%¹"] },
            { label: "规划“四比”要求", items: ["比自己：2026-2030 按年跟踪 **%。", "比市场：保持优于市场。", "比标杆：保持优于竞对均值。"] },
            { label: "30年目标", items: ["***%"] },
          ] },
          { title: "车险COR", items: [], columns: [
            { label: "26年目标", items: ["***%"] },
            { label: "规划“四比”要求", items: ["比自己：2026-2030 按年跟踪 **%。", "比市场：保持优于市场。", "比标杆：保持优于竞对均值。"] },
            { label: "30年目标", items: ["***%"] },
          ] },
          { title: "非车COR", items: [], columns: [
            { label: "26年目标", items: ["***%"] },
            { label: "规划“四比”要求", items: ["比自己：2026-2030 按年跟踪 **%。", "比市场：保持优于市场。", "比标杆：保持优于竞对均值。"] },
            { label: "30年目标", items: ["***%"] },
          ] },
        ],
      },
      {
        title: "K0 4/4",
        subtitle: "支持集团各项战略落地",
        blocks: [
          { title: "K0-4 企康业绩（产品方）", items: [], columns: [
            { label: "26年目标", items: ["***亿"] },
            { label: "规划“四比”要求", items: ["比自己：2026-2030 按年跟踪 **。", "比市场：新增规模市占率超 **%。", "比标杆：新增规模市占率超主要竞对。"] },
            { label: "30年目标", items: ["***亿"] },
          ] },
          { title: "K0-5 综金客户指标", items: [], columns: [
            { label: "规划“四比”要求", items: ["比市场：以个金规划为准。"] },
          ] },
          { title: "K0-6 ROE", items: [], columns: [
            { label: "26年目标", items: ["***%"] },
            { label: "规划“四比”要求", items: ["比自己：2026-2030 按年跟踪 **%。", "比市场：ROE超市场平均。", "比标杆：ROE超竞对均值。"] },
            { label: "30年目标", items: ["***%"] },
          ] },
          { title: "K0-7 偿付能力充足率", items: [], columns: [
            { label: "规划“四比”要求", items: ["比市场：综合偿付能力充足率 ≥ **%。"] },
          ] },
        ],
      },
    ],
    metrics: [
      { code: "K0-1", name: "净利润", value: "***亿", method: "一表利润 / 投资收益", target: "增速优于市场，收益率超市场，三年滚动 CII 位于同业前列" },
      { code: "K0-2", name: "整体份额（不含 HS）", value: "***%", method: "整体、车险、非车多口径拆解", target: "份额持续提升，车险通过 H-S 挑战行业第一，非车达到标杆 ***%" },
      { code: "K0-3", name: "COR", value: "***%", method: "车险 COR / 非车 COR", target: "整体及条线品质优于市场水平，并挑战优于主要竞争对手" },
      { code: "K0-4", name: "企康业绩", value: "***亿", target: "新增规模市占率超 **%，并优于主要竞对" },
      { code: "K0-5", name: "综金客户指标", target: "以个金规划为准，提升高质量客户留存" },
      { code: "K0-6", name: "ROE", value: "***%", target: "ROE 超市场平均，并优于竞对均值" },
      { code: "K0-7", name: "偿付能力充足率", target: "综合偿付能力充足率达到规划底线" },
    ],
    sections: [
      { title: "规划口径", items: ["每项指标同时跟踪比自己、比市场、比标杆三类参照。", "2026-2030 年逐年设置目标，短期看年度达成，长期看市场位置。"] },
      { title: "智能关注", items: ["利润、份额和 COR 互为约束，计划视图优先暴露冲突项。", "企康、ROE 与偿付能力作为集团战略落地的关键结果指标。"] },
    ],
  },
  {
    id: "K1",
    title: "年度目标盘",
    headline: "净利润及承保利润增速跑赢同业，投资收益率超市场平均",
    summary: "把 K0 的长期经营结果落到 2026 年目标值，明确比市场、比标杆口径与年度目标表达。",
    accent: "green",
    sourceCards: [
      {
        title: "K1 1/3",
        subtitle: "净利润及承保利润增速跑赢同业，投资收益率超市场平均",
        blocks: [
          { title: "K1-1 净利润", items: [], columns: [
            { label: "指标", items: ["承保利润", "投资收益"] },
            { label: "比市场、比标杆", items: ["承保利润：比市场增速跑赢主要同业；比标杆利润率超竞对均值。", "投资收益：比市场收益率超市场平均；比标杆收益率超竞对均值。"] },
            { label: "2026年目标值", items: ["承保利润：***亿，同比 +**%。", "投资收益：***亿，同比 +**%。"] },
          ] },
        ],
      },
      {
        title: "K1 2/3",
        subtitle: "份额持续提升，COR 保持优于市场",
        blocks: [
          { title: "K1-2 整体份额（不含HS）", items: [], columns: [
            { label: "指标", items: ["整体份额（不含HS）", "车险份额（含HS）", "车险份额（不含HS）", "非车份额（不含HS）"] },
            { label: "比市场、比标杆", items: ["整体份额：比市场份额持续提升；比标杆份额提升幅度超竞对。", "车险份额（含HS）：比市场份额持续提升；比标杆份额提升幅度超竞对。", "车险份额（不含HS）：比市场按行业自身不低于市场增速。", "非车份额：比市场各条线份额持续提升；比标杆份额提升幅度超竞对。"] },
            { label: "2026年目标值", items: ["整体份额：***%，同比 +***。", "车险份额（含HS）：***%，同比 +***。", "车险份额（不含HS）：***%，同比 ***。", "非车份额：***%，同比 +***。"] },
          ] },
          { title: "K1-3 COR", items: [], columns: [
            { label: "指标", items: ["整体COR", "车险COR", "非车COR"] },
            { label: "比市场、比标杆", items: ["整体COR：比市场保持优于市场；比标杆保持优于竞对均值。", "车险COR：比市场保持优于市场；比标杆保持优于竞对均值。", "非车COR：比市场保持优于市场；比标杆保持优于竞对均值。"] },
            { label: "2026年目标值", items: ["整体COR：***%，同比 ***。", "车险COR：***%，同比 +***。", "非车COR：***%，同比 -***。"] },
          ] },
        ],
      },
      {
        title: "K1 3/3",
        subtitle: "企康与综金达成集团要求，ROE 与偿付能力充足率达成目标计划",
        blocks: [
          { title: "K1-4 企康业绩", items: [], columns: [
            { label: "比市场、比标杆", items: ["新增规模市占率 **%。"] },
            { label: "2026年目标值", items: ["***，同比 +***%。"] },
          ] },
          { title: "K1-5 综金客户指标", items: [], columns: [
            { label: "比市场、比标杆", items: ["高质量获客，提高客户留存。"] },
            { label: "2026年目标值", items: ["以后续个金规划为准。"] },
          ] },
          { title: "K1-6 ROE", items: [], columns: [
            { label: "比市场、比标杆", items: ["比市场：保持优于市场。", "比标杆：保持优于竞对均值。"] },
            { label: "2026年目标值", items: ["***%"] },
          ] },
          { title: "K1-7 偿付能力充足率", items: [], columns: [
            { label: "核心要求", items: ["偿付能力保持充足。"] },
            { label: "2026年目标值", items: ["综合偿付能力充足率 ≥ ***%。"] },
          ] },
        ],
      },
    ],
    metrics: [
      { code: "K1-1", name: "净利润", value: "***亿，同比 +**%", method: "承保利润、投资收益", target: "比市场增速跑赢主要同业；比标杆利润率超竞对均值 / 收益率超竞对均值" },
      { code: "K1-2", name: "整体份额（不含 HS）", value: "***%，同比提升", method: "整体份额、车险份额含/不含 HS、非车份额", target: "份额持续提升，提升幅度超主要竞对" },
      { code: "K1-3", name: "COR", value: "***%，同比优化", method: "整体、车险、非车 COR", target: "保持优于市场，保持优于竞对均值" },
      { code: "K1-4", name: "企康业绩", value: "***，同比 +***%", target: "新增规模市占率 **%" },
      { code: "K1-5", name: "综金客户指标", target: "高质量获客，提高客户留存，以个金规划为准" },
      { code: "K1-6", name: "ROE", value: "***%", target: "保持优于市场，保持优于竞对均值" },
      { code: "K1-7", name: "偿付能力充足率", target: "综合偿付能力充足率 ≥ ***%" },
    ],
    sections: [
      { title: "年度目标表达", items: ["目标值保留原规划中的脱敏占位，页面突出指标逻辑和比较口径。", "同一指标下沉展示市场参照、标杆参照和年度值，便于计划会快速确认。"] },
      { title: "对 K0 的承接", items: ["K1 是 K0 的年度化版本，用于年度计划制定、月度追踪和后续 K2 分解。"] },
    ],
  },
  {
    id: "K2",
    title: "经营追踪盘",
    headline: "支撑 K1 的过程指标，结合一表一会强化追踪",
    summary: "把年度结果指标拆成经营追踪口径，形成承保数、投资数、业务线与 K1-K3 的连接关系。",
    accent: "amber",
    sourceCards: [
      {
        title: "K2",
        subtitle: "支撑 K1 的过程指标，结合一表一会强化追踪",
        blocks: [
          { title: "K1", items: [], columns: [
            { label: "K1年度计划", items: ["K1-1 净利润：**亿。", "K1-2 整体份额：**%。", "K1-3 COR：**%。", "K1-4 企康业绩：**亿。", "K1-5 综金客户指标：待定。", "K1-6 ROE：**%。", "K1-7 偿付能力充足率：**%。"] },
          ] },
          { title: "K2 - 经营追踪", items: [], columns: [
            { label: "分解至K2指标", items: ["承保数。", "投资数。"] },
            { label: "落实至业务线", items: ["承保数：车险保费、车险COR、非车保费、非车COR。", "投资数：个均可投资资产、考核投资收益、免税增厚、考核含免税TII。"] },
            { label: "形成业务线K1-K3", items: ["车险保费：商用车保费、家用车保费、新能源车保费、HS规模（20亿）。", "车险COR：车险整体COR、新能源车保单成本率。", "非车保费：个非保费、团财保费、农险保费。", "非车COR：个非COR、团财COR、农险COR。"] },
          ] },
        ],
      },
    ],
    metrics: [
      { name: "承保数", method: "由净利润分解至 K2 指标", target: "车险保费、车险 COR、非车保费、非车 COR" },
      { name: "投资数", method: "由投资收益分解至过程指标", target: "个均可投资资产、考核投资收益、免税增厚、考核含免税 TII" },
      { name: "业务线 K1-K3", method: "形成条线经营树", target: "商用车、家用车、新能源、HS、个非、团财、农险等业务线逐层下钻" },
    ],
    sections: [
      { title: "承保经营树", items: ["车险保费拆至商用车保费、家用车保费、新能源车保费和 HS 规模。", "车险 COR 拆至车险整体 COR 与新能源车保单成本率。", "非车保费拆至个非保费、团财保费、农险保费。", "非车 COR 拆至个非 COR、团财 COR、农险 COR。"] },
      { title: "投资经营树", items: ["聚焦可投资资产、考核投资收益、免税增厚和含免税口径 TII。", "用过程指标承接利润结果，便于一表一会滚动复盘。"] },
    ],
  },
  {
    id: "K3",
    title: "进踪检视盘",
    headline: "非车在健康险、宠物险、小微、企康等方面谋求突破，车险重点发展 H&S",
    summary: "把关键策略工程落到责任人、项目目标和检视节奏，覆盖非车增长、H&S、压舱石等重点项目。",
    accent: "blue",
    sourceCards: [
      {
        title: "K3 1/2",
        subtitle: "非车业务在健康险、宠物险、小微、企康等方面谋求突破",
        blocks: [
          { title: "K3-1 企康发展策略", items: [], columns: [
            { label: "分类 / 编号", items: ["进踪检视类", "K3-1"] },
            { label: "关键工程及责任人", items: ["企康发展策略", "徐华、曹敬之（企康）"] },
            { label: "项目目标", items: ["目标：达成集团26年各项考核指标（待集团下发）。"] },
            { label: "关键举措", items: ["围绕客户需求，构建标准化到企服务体系，提升线上运营能力，助力企业客户留存与持续消费。"] },
            { label: "时间计划", items: ["季度检视。", "H1检视企康获客。", "全年完成目标。"] },
          ] },
          { title: "K3-2 非车发展策略", items: [], columns: [
            { label: "分类 / 编号", items: ["进踪检视类", "K3-2"] },
            { label: "关键工程及责任人", items: ["非车发展策略", "丁羽、朱斌（个健险、宠物险）", "徐华、石得（小微）"] },
            { label: "项目目标", items: ["未来三年，各非车险种发展目标均超市场。", "个人健康险经营：个健康 **亿，超市场 **，份额 **，保单成本率 **；百万医客户数 **万。", "宠物险突破：市场份额 **%，两率 ≤ **%；服务客户数 **；服务GMV **万元。", "小微综合业务探索：规模增速 **，规模 **。"] },
            { label: "关键举措", items: ["个人健康险经营：完善客户定价模型，建立一客一价能力，依托集团医生生态优势，创新服务型产品，实现个健康突破。", "宠物险突破：整合服务资源，运营好车主及内外部用户，探索与医疗企业共建标准并提升风控理赔能力，实现突破发展。", "小微综合业务探索：在重点小微企业领域深化推广保险+信贷+服务的综合一揽子模式。"] },
            { label: "时间计划", items: ["季度检视。", "H1检视宠物险/健康险/小微/企康事务。", "全年完成目标。"] },
          ] },
        ],
      },
      {
        title: "K3 2/2",
        subtitle: "车险重点发展 H&S 项目，投资提升确定性收益占比",
        blocks: [
          { title: "K3-3 车险H&S发展策略", items: [], columns: [
            { label: "分类 / 编号", items: ["进踪检视类", "K3-3"] },
            { label: "关键工程及责任人", items: ["车险H&S发展策略", "丁羽"] },
            { label: "项目目标", items: ["目标：潜客 **万，主体覆盖率 **，机构渗透率 **；五年车险规模成为市场第一。"] },
            { label: "关键举措", items: ["发挥渠道、平台等资源优势，依托风险筛选、费用及运营成本优势，降低中小公司车险成本，让中小公司实现盈利，平安从中分润。"] },
            { label: "时间计划", items: ["季度检视。", "H1检视HS贡献。", "全年完成目标。"] },
          ] },
          { title: "K3-4 产险SAA压舱石规划", items: [], columns: [
            { label: "分类 / 编号", items: ["进踪检视类", "K3-4"] },
            { label: "关键工程及责任人", items: ["产险SAA压舱石规划", "龙余、史良洵、李亚男"] },
            { label: "项目目标", items: ["目标：广险确定性投资收益占比提升至2/3以上。"] },
            { label: "关键举措", items: ["推动执行2025年制定的压舱石规划，通过增配高分红股、另类等压舱石资产，提升确定性投资收益占比。"] },
            { label: "时间计划", items: ["季度检视。", "月度观察NII贡献。", "季度检视执行进展。", "全年复盘落地情况。"] },
          ] },
        ],
      },
    ],
    metrics: [
      { code: "K3-1", name: "企康发展策略", method: "徐华、曹敬之（企康）", target: "达成集团 2026 年各项考核指标，构建标准化到企服务体系，提升线上运营能力" },
      { code: "K3-2", name: "非车发展策略", method: "丁羽、朱斌、徐华、石得", target: "未来三年各非车险种发展目标均超市场，健康险、宠物险、小微综合业务、企康形成突破" },
      { code: "K3-3", name: "车险 H&S 发展策略", method: "丁羽", target: "潜客、主体覆盖率、机构渗透率达标，五年车险规模成为市场第一" },
      { code: "K3-4", name: "产险 SAA 压舱石规划", method: "龙余、史良洵、李亚男", target: "广险确定性投资收益占比提升至 2/3 以上" },
    ],
    sections: [
      { title: "季度检视", deadline: "H1", items: ["检视企康获客与全年完成目标。", "检视宠物险、健康险、小微、企康事务的全年目标完成节奏。", "检视 HS 贡献和 NII 贡献，跟踪压舱石执行进展。"] },
      { title: "关键举措", items: ["围绕客户需求构建到企服务体系。", "完善客户定价模型，建立一客一价能力。", "整合服务资源，适配车主及内外部用户。", "推动高分红股、另类等压舱石资产配置。"] },
    ],
  },
  {
    id: "K4",
    title: "底线风控盘",
    headline: "严格落实底线铁律，防范重大风险",
    summary: "围绕经营底线、风控底线、运营底线、合规底线建立硬约束，将计划目标与风险边界放在同一视图。",
    accent: "slate",
    sourceCards: [
      {
        title: "K4",
        subtitle: "严格落实底线铁律，防范重大风险",
        blocks: [
          { title: "定量核心 K4：经营底线", items: ["财务业绩真实：不发生财务业绩虚增造假。", "收入成本增速：收入增速 > 成本增速。", "COR：< **%。", "投资业绩：投资收益 > 负债成本。", "交易对手集中度：不超限。", "巨灾集中度：不超限。", "不良生成情况：不良生成额 ≤ **亿，对应不良生成率² ≤ **%。", "投备覆盖率：≥ **%。", "VaR：≤ **亿。", "偿付能力充足率¹：综合 ≥ **%，核心 ≥ **%。", "重大风险事件：不发生重大系统性、周期性、产品、合规、财务、科技、声誉风险等事件，不发生重大业内涉刑案件。"] },
          { title: "定性评价 K4：运营底线", items: ["公司运营底线要求：不发生突破公司运营底线要求的事件。", "清单详见附件。"] },
          { title: "定性评价 K4：合规底线", items: ["公司合规底线要求：不发生突破公司合规底线要求的事件。", "清单详见附件。"] },
        ],
      },
    ],
    metrics: [
      { name: "财务业绩真实", target: "不发生财务业绩虚增造假" },
      { name: "收入成本增速", target: "收入增速 > 成本增速" },
      { name: "COR", target: "< **%" },
      { name: "投资业绩", target: "投资收益 > 负债成本" },
      { name: "交易对手集中度 / 巨灾集中度", target: "不超限" },
      { name: "不良生成情况", target: "不良生成额 ≤ **亿，对应不良生成率² ≤ **%" },
      { name: "投资覆盖率 / VaR", target: "覆盖率 ≥ **%，VaR ≤ **亿" },
      { name: "偿付能力充足率", target: "综合 ≥ **%，核心 ≥ **%" },
    ],
    sections: [
      { title: "重大风险事件", items: ["不发生重大系统性、周期性、产品、合规、财务、科技、声誉风险等事件。", "不发生重大业内涉刑案件。"] },
      { title: "运营与合规底线", items: ["不发生突破公司运营底线要求的事件。", "不发生突破公司合规底线要求的事件。"] },
    ],
  },
  {
    id: "K5",
    title: "机制改革盘",
    headline: "业绩持续增长，人力三总额不增，通过机制改革激发组织活力、提升投产效益",
    summary: "用机制改革、理赔模式改革和投资条线改革三组关键工作，约束成本、效率和组织活力。",
    accent: "green",
    sourceCards: [
      {
        title: "K5",
        subtitle: "业绩持续增长，人力三总额不增，通过机制改革，激发组织活力、提升投产效益",
        blocks: [
          { title: "机制改革成效", items: ["考核：2025 年总部做实下沉机构，2026 年联合企划层层拆解、深入全员落实。", "激励：2025 年年终奖落实“三倾四好”，2026 年围绕“1+3+8”重点项目进行专项激励资源倾斜。", "投产：聚焦 **% 销售人力成本，联同条线看清投产数据，常规业务挤水分，重点新兴板块加投，SPV 率值优化 0.15pt。", "时间计划：12月31日。"] },
          { title: "理赔模式改革", items: ["业务模式与组织变革：加快数字化转型，厘清理赔模式、流程、组织职责。", "薪酬机制：作业人员落实全险种计件薪，多劳多得、优质优薪。", "专家队伍建设：专家队伍基本法完善，专业能力提升。", "时间计划：6月30日。"] },
          { title: "投资条线改革", items: ["业务模式与组织变革：明确投资定位与目标，重塑业务流程与组织架构。", "投资基本法：设立投资基本法，考核目标层层穿透，激励匹配业绩贡献。", "时间计划：6月30日。"] },
        ],
      },
    ],
    metrics: [
      { name: "机制改革成效", target: "总部做实下沉机构，联合企划层层拆解，全员落实" },
      { name: "理赔模式改革", target: "加快数字化转型，厘清理赔模式、流程、组织职责" },
      { name: "投资条线改革", target: "明确投资定位与目标，重塑业务流程与组织架构" },
    ],
    sections: [
      { title: "机制改革成效", deadline: "12月31日", items: ["考核：2025 年总部做实下沉机构，2026 年联合企划层层拆解、深入全员落实。", "激励：2025 年末奖励落实“三倾四好”，2026 年围绕“1+3+8”重点项目进行专项激励资源倾斜。", "投产：聚焦 **% 销售人力成本，联同条线看清投产数据、常规业务挤水分，重点新兴板块加投，SPV 率值优化 0.15pt。"] },
      { title: "理赔模式改革", deadline: "6月30日", items: ["加快数字化转型，厘清理赔模式、流程和组织职责。", "作业人员落实全险种计件薪，多劳多得、优质优薪。", "专家队伍基本法完善，专业能力提升。"] },
      { title: "投资条线改革", deadline: "6月30日", items: ["明确投资定位与目标，重塑业务流程与组织架构。", "建立投资基本法，考核目标层层穿透，激励匹配业绩贡献。"] },
    ],
  },
  {
    id: "K6",
    title: "组织架构盘",
    headline: "组织架构支撑战略与经营，压实责任、精简高效",
    summary: "对产险总部进行结构优化，以个人、团体、理赔运营、投资、科技中心、共同资源中心为主线压实职责。",
    accent: "amber",
    sourceCards: [
      {
        title: "K6",
        subtitle: "组织架构支撑战略与经营，压实责任、精简高效",
        blocks: [
          { title: "调整前", items: ["产险总部。", "L1：52；编制：**；职数：82 中层、308 基层。", "L0：个人、团体、理赔运营、投资、科技中心、共同资源中心。", "个人：客户经营、产品、渠道、平台等条线。", "团体：客户、产品、渠道、平台等条线。", "理赔运营：风险运营中台、用户运营中台、成本中台、作业管理、消保等。", "投资：资产管理。", "科技中心：个人客户开发、个人产品开发、团体开发、理赔开发、AI、三规划、质效管理、数据智能中台等。", "共同资源中心：人力行政、财务、企划、精算、风险管理、法律合规、消保、北代、机构经营管理等。"] },
          { title: "核心变化 1-4", items: ["1 精益：客户大数据团队转型客户经营部。", "2 精简：撤销个金，职能纳入综合金融部。", "3 精简：撤销联合车险，职能纳入车险。", "4 精简：撤销总体发展，职能纳入车代。"] },
          { title: "核心变化 5-8", items: ["5 精简：合并宠物相关部门，整合为项目组。", "6 转型：小微项目组转型团体客户部。", "7 精简：健康险事业部（政保）整合纳入政保部。", "8 精简：合并原理赔 4 个部门，整合为 3 个部门。"] },
          { title: "核心变化 9-12", items: ["9 增设：资产管理部 1 拆 2。", "10 精简：合并个人研发 2 个部门，整合为 1 个部门。", "11 精简：合并 AI、智能数据 2 个部门，整合为 1 个部门。", "12 增设：增设风控技术部（人力、财务、企划、精算、风控、法合、消保、北代、机构经营管理独立部门）。"] },
          { title: "调整后", items: ["产险总部。", "L1：46；编制：**；职数：77 中层、302 基层。", "调整后仍按个人、团体、理赔运营、投资、科技中心、共同资源中心等主线支撑战略与经营。"] },
        ],
      },
    ],
    metrics: [
      { name: "调整前规模", value: "L1：52；编制：**；职数：82 中层、308 基层" },
      { name: "调整后规模", value: "L1：46；编制：**；职数：77 中层、302 基层" },
      { name: "核心变化", value: "12 项", target: "压实经营责任，合并重复职能，增设风控技术部" },
    ],
    sections: [
      { title: "精简合并", items: ["客户大数据团队转型客户经营部。", "撤销个金、联合车险、总体发展等重复或过渡组织，职能并入对应条线。", "合并宠物险相关部门，整合为项目组。", "合并个人研发、AI 与智能数据相关部门。"] },
      { title: "转型与增设", items: ["小微项目组转型为团体客户部。", "健康险事业部整合纳入政保部。", "资产管理部 1 拆 2，强化投资管理职责。", "增设风控技术部，承接人力、财务、企划、精算、风控、法合、消保、北代、机构经营管理等能力。"] },
    ],
  },
];

const PLAN_TONE_CLASS: Record<PlanPhase["accent"], { badge: string; icon: string; line: string; soft: string }> = {
  blue: {
    badge: "bg-primary-soft text-accent-foreground",
    icon: "bg-primary text-primary-foreground",
    line: "from-primary/80 to-sky-400",
    soft: "bg-primary-soft/70",
  },
  green: {
    badge: "bg-success-soft text-success",
    icon: "bg-success text-white",
    line: "from-success/80 to-emerald-300",
    soft: "bg-success-soft/70",
  },
  amber: {
    badge: "bg-warning-soft text-warning",
    icon: "bg-warning text-white",
    line: "from-warning/85 to-amber-300",
    soft: "bg-warning-soft/70",
  },
  slate: {
    badge: "bg-slate-100 text-slate-700",
    icon: "bg-slate-800 text-white",
    line: "from-slate-700 to-slate-400",
    soft: "bg-slate-100",
  },
};

function ManagerPlanBoard() {
  const [activePlan, setActivePlan] = useState<PlanPhase["id"]>("K0");
  const visiblePlanPhases = PLAN_PHASES.filter((phase) => phase.id !== "K5" && phase.id !== "K6");

  const jumpToPhase = (id: PlanPhase["id"]) => {
    setActivePlan(id);
    document.getElementById(`plan-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-[linear-gradient(180deg,rgba(248,250,252,0.92),rgba(255,255,255,0.98))] px-5 py-5">
      <div className="mx-auto max-w-[1440px]">
        <div className="sticky top-14 z-20 rounded-2xl border border-border bg-white/92 p-2 shadow-[0_12px_30px_rgba(15,23,42,0.08)] backdrop-blur">
          <div className="flex flex-wrap gap-2">
            {visiblePlanPhases.map((phase) => {
              const active = phase.id === activePlan;
              return (
                <button
                  key={phase.id}
                  type="button"
                  onClick={() => jumpToPhase(phase.id)}
                  className={`flex min-w-[72px] items-center justify-center rounded-xl px-3 py-2 transition ${
                    active ? "bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)]" : "text-slate-600 hover:bg-secondary"
                  }`}
                >
                  <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg text-xs font-black ${
                    active ? "bg-white text-slate-950" : PLAN_TONE_CLASS[phase.accent].badge
                  }`}>
                    {phase.id}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-3 space-y-3">
          {visiblePlanPhases.map((phase) => (
            <PlanPhaseSection key={phase.id} phase={phase} />
          ))}
        </div>
      </div>
    </div>
  );
}

function PlanBoardStat({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="rounded-xl bg-slate-50 px-4 py-3 ring-1 ring-border/70">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <div className="mt-1 flex items-end gap-2">
        <strong className="text-2xl font-black leading-none text-slate-950">{value}</strong>
        <span className="pb-0.5 text-xs font-semibold text-slate-400">{hint}</span>
      </div>
    </div>
  );
}

function PlanPhaseSection({ phase }: { phase: PlanPhase }) {
  const tone = PLAN_TONE_CLASS[phase.accent];
  return (
    <section id={`plan-${phase.id}`} className="scroll-mt-32 rounded-2xl border border-border bg-white shadow-[0_14px_40px_rgba(31,47,71,0.055)]">
      <div className="min-w-0 p-2.5">
        <div className="grid gap-2.5">
          {phase.sourceCards.map((card, cardIndex) => (
            <PlanSourceCardView
              key={`${phase.id}-${card.title}`}
              card={card}
              tone={tone}
              index={cardIndex}
              total={phase.sourceCards.length}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function PlanSourceCardView({
  card,
  tone,
  index,
  total,
}: {
  card: PlanSourceCard;
  tone: (typeof PLAN_TONE_CLASS)[PlanPhase["accent"]];
  index: number;
  total: number;
}) {
  const [open, setOpen] = useState(true);
  const family = card.title.split(" ")[0];
  const layout =
    family === "K0" ? "comparison" :
    family === "K1" ? "annual" :
    family === "K2" ? "flow" :
    family === "K3" ? "project" :
    family === "K6" ? "org" :
    "table";

  return (
    <article className="overflow-hidden rounded-xl bg-white shadow-[0_8px_22px_rgba(15,23,42,0.045)] ring-1 ring-border/60">
      <div className="flex flex-wrap items-center gap-2 bg-slate-50/70 px-3 py-2">
        <span className={`rounded-md px-2 py-0.5 text-[11px] font-black ${tone.badge}`}>{card.title}</span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-black leading-5 text-slate-950">{card.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white text-slate-500 shadow-sm ring-1 ring-border/70 transition hover:text-primary hover:ring-primary/30"
          aria-label={open ? "收起计划卡片" : "展开计划卡片"}
        >
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
      </div>
      {open && (
        <>
          {layout === "comparison" && <PlanComparisonLayout card={card} tone={tone} />}
          {layout === "annual" && <PlanAnnualLayout card={card} tone={tone} />}
          {layout === "flow" && <PlanFlowLayout card={card} tone={tone} />}
          {layout === "project" && <PlanProjectLayout card={card} tone={tone} />}
          {layout === "table" && <PlanTableLayout card={card} tone={tone} />}
          {layout === "org" && <PlanOrgLayout card={card} tone={tone} />}
        </>
      )}
    </article>
  );
}

function PlanComparisonLayout({ card, tone }: { card: PlanSourceCard; tone: (typeof PLAN_TONE_CLASS)[PlanPhase["accent"]] }) {
  return (
    <div className="bg-white p-2">
      <div className="space-y-1.5">
        {card.blocks.map((block) => (
          <div key={block.title} className="rounded-lg bg-slate-50/70 p-2">
            <div className="rounded-md bg-white px-2.5 py-1.5 shadow-sm ring-1 ring-slate-200/70">
              <p className="text-[12px] font-black text-slate-950">{block.title}</p>
            </div>
            <PlanColumnGrid columns={block.columns ?? [{ label: "内容", items: block.items }]} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanAnnualLayout({ card, tone }: { card: PlanSourceCard; tone: (typeof PLAN_TONE_CLASS)[PlanPhase["accent"]] }) {
  return (
    <div className="bg-white p-2">
      <div className="space-y-1.5">
        {card.blocks.map((block) => (
          <div key={block.title} className="rounded-lg bg-slate-50/70 p-2">
            <div className="rounded-md bg-white px-2.5 py-1.5 shadow-sm ring-1 ring-slate-200/70">
              <p className="text-[12px] font-black text-slate-950">{block.title}</p>
            </div>
            <PlanColumnGrid columns={block.columns ?? [{ label: "内容", items: block.items }]} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanFlowLayout({ card, tone }: { card: PlanSourceCard; tone: (typeof PLAN_TONE_CLASS)[PlanPhase["accent"]] }) {
  return (
    <div className="bg-white p-2">
      <div className="grid gap-1.5 lg:grid-cols-[1fr_20px_1.1fr]">
        {card.blocks.map((block, idx) => (
          <div key={block.title} className="contents">
            <div className="rounded-lg bg-slate-50 p-2 shadow-sm ring-1 ring-border/70">
              <p className="text-[12px] font-black text-slate-950">{block.title}</p>
              {block.columns ? (
                <PlanColumnGrid columns={block.columns} />
              ) : (
                <div className="mt-2 space-y-2">
                  {block.items.map((item) => <PlanBullet key={item} item={item} tone={tone} />)}
                </div>
              )}
            </div>
            {idx < card.blocks.length - 1 && (
              <div className="hidden items-center justify-center text-2xl font-black text-slate-300 lg:flex">›</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanProjectLayout({ card, tone }: { card: PlanSourceCard; tone: (typeof PLAN_TONE_CLASS)[PlanPhase["accent"]] }) {
  return (
    <div className="bg-white p-2">
      <div className="space-y-1.5">
        {card.blocks.map((block) => {
          return (
            <div key={block.title} className="rounded-lg bg-slate-50/70 p-2">
              <div className="rounded-md bg-white px-2.5 py-1.5 shadow-sm ring-1 ring-slate-200/70">
                <p className="text-[12px] font-black text-slate-950">{block.title}</p>
              </div>
              <PlanColumnGrid columns={block.columns ?? [{ label: "内容", items: block.items }]} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlanTableLayout({ card, tone }: { card: PlanSourceCard; tone: (typeof PLAN_TONE_CLASS)[PlanPhase["accent"]] }) {
  return (
    <div className="bg-white p-2">
      <div className="space-y-1.5">
        {card.blocks.map((block) => (
          <div key={block.title} className="rounded-lg bg-slate-50/70 p-2">
            <div className="rounded-md bg-white px-2.5 py-1.5 shadow-sm ring-1 ring-slate-200/70">
              <p className="text-[12px] font-black text-slate-950">{block.title}</p>
            </div>
            <PlanColumnGrid columns={block.columns ?? [{ label: "内容", items: block.items }]} />
          </div>
        ))}
      </div>
    </div>
  );
}

function PlanOrgLayout({ card, tone }: { card: PlanSourceCard; tone: (typeof PLAN_TONE_CLASS)[PlanPhase["accent"]] }) {
  const groupsBefore = [
    { name: "个人", items: ["客户大数据", "车险", "个非", "电销渠道", "车代渠道", "创新渠道", "个人综合金融", "联合车险", "慈善", "网上客户", "线上渠道", "站场平台运营", "宠物平台研发", "宠物渠道拓展", "宠物产品研发"] },
    { name: "团体", items: ["小微", "企政客户", "团体财产险", "再保险", "农财保险", "团体综合金融", "团体渠道", "政保", "健康险"] },
    { name: "理赔运营", items: ["风险运营中台", "用户运营中台", "成本中台", "作业管理", "消保"] },
    { name: "投资", items: ["资产管理"] },
    { name: "科技中心", items: ["个人客户开发", "个人产品开发", "个人渠道开发", "团体开发", "理赔运营开发", "二规划", "三规划", "质效管理", "数据智能中台", "数据安全基础"] },
    { name: "共同资源中心", items: ["人力行政", "财务", "企划", "精算", "风险管理", "法律合规", "消保", "北代", "机构经营管理", "机构组织管理"] },
  ];

  const groupsAfter = [
    { name: "个人", items: ["客户经营", "车险", "产品", "渠道", "平台", "宠物险"] },
    { name: "团体", items: ["团体客户", "团体产品", "团体渠道", "再保险", "农财保险", "综合金融"] },
    { name: "理赔运营", items: ["风险技术", "理赔经营", "理赔技术", "平台运营", "消保"] },
    { name: "投资", items: ["配置投资", "投资评估"] },
    { name: "科技中心", items: ["个人客户开发", "个人产品开发", "团体开发", "理赔开发", "数据与AI", "二规划", "质效管理"] },
    { name: "共同资源中心", items: ["人力行政", "财务", "企划", "精算", "风险管理", "法律合规", "消保", "北代", "机构经营管理"] },
  ];

  const changes = [
    "① 转型：客户大数据团队转型客户经营部",
    "② 精简：撤销个金，职能纳入综合金融部",
    "③ 精简：撤销联合车险，职能纳入车险",
    "④ 精简：撤销总体发展，职能纳入车代",
    "⑤ 精简：合并宠物相关部门，整合为项目组",
    "⑥ 转型：小微项目组转型团体客户部",
    "⑦ 精简：健康险事业部（政保）整合纳入政保部",
    "⑧ 精简：合并原理赔4个部门，整合为3个部门",
    "⑨ 增设：资产管理部1拆2",
    "⑩ 精简：合并个人研发2个部门，整合为1个部门",
    "⑪ 精简：合并AI、智能数据2个部门，整合为1个部门",
    "⑫ 增设：增设风控技术部",
  ];

  return (
    <div className="bg-white p-3">
      <div className="space-y-3">
        <OrgSnapshot
          label="调整前"
          meta="L1：52；编制：**；职数：82中层、308基层"
          groups={groupsBefore}
          tone="before"
        />
        <div className="rounded-xl bg-orange-50/80 p-3 ring-1 ring-orange-100">
          <div className="mb-2 flex items-center gap-2">
            <span className="rounded-md bg-white px-2 py-1 text-[11px] font-black text-orange-700 ring-1 ring-orange-200">核心变化</span>
            <span className="text-[11px] font-semibold text-orange-700">对应原型中的 1-12 项调整</span>
          </div>
          <div className="grid gap-1.5 md:grid-cols-2 xl:grid-cols-3">
            {changes.map((change) => (
              <div key={change} className="rounded-lg bg-white px-2.5 py-1.5 text-[11px] font-semibold leading-5 text-slate-700 shadow-sm ring-1 ring-orange-100">
                {change}
              </div>
            ))}
          </div>
        </div>
        <OrgSnapshot
          label="调整后"
          meta="L1：46；编制：**；职数：77中层、302基层"
          groups={groupsAfter}
          tone="after"
        />
      </div>
    </div>
  );
}

function OrgSnapshot({
  label,
  meta,
  groups,
  tone,
}: {
  label: string;
  meta: string;
  groups: Array<{ name: string; items: string[] }>;
  tone: "before" | "after";
}) {
  return (
    <div className={`rounded-xl p-3 ring-1 ${tone === "before" ? "bg-slate-50 ring-slate-200" : "bg-orange-50/40 ring-orange-100"}`}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className={`rounded-md px-2 py-1 text-[11px] font-black ${tone === "before" ? "bg-slate-800 text-white" : "bg-orange-600 text-white"}`}>{label}</span>
        <div className="mx-auto min-w-[220px] rounded-md bg-white px-5 py-1.5 text-center text-[12px] font-black text-slate-700 shadow-sm ring-1 ring-slate-200">
          产险总部
        </div>
        <span className="text-[11px] font-bold text-slate-500">{meta}</span>
      </div>

      <div className="relative">
        <div className="absolute left-0 top-9 hidden h-[calc(100%-42px)] w-6 border-l-2 border-slate-300 lg:block" />
        <div className="mb-2 hidden pl-8 text-[11px] font-black text-slate-500 lg:block">L0 / L1</div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-3 xl:grid-cols-6">
          {groups.map((group) => (
            <div key={`${label}-${group.name}`} className="min-w-0 rounded-lg bg-white p-2 shadow-sm ring-1 ring-slate-200/80">
              <div className="rounded-md bg-slate-200 px-2 py-1 text-center text-[12px] font-black text-slate-700">
                {group.name}
              </div>
              <div className="mt-2 grid grid-cols-3 gap-1 sm:grid-cols-4 md:grid-cols-3">
                {group.items.map((item) => (
                  <div
                    key={`${group.name}-${item}`}
                    className="flex min-h-[86px] items-center justify-center rounded border border-slate-300 bg-slate-50 px-1 py-1 text-center text-[10px] font-semibold leading-3 text-slate-600"
                    style={{ writingMode: "vertical-rl", textOrientation: "mixed" }}
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function PlanCell({ items, emptyLabel = "—" }: { items: string[]; emptyLabel?: string }) {
  return (
    <div className="space-y-2 px-4 py-3">
      {(items.length ? items : [emptyLabel]).map((item) => (
        <p key={item} className={`text-[11px] font-semibold leading-5 ${item === emptyLabel ? "text-slate-400" : "text-slate-600"}`}>{item}</p>
      ))}
    </div>
  );
}

function PlanColumnGrid({ columns }: { columns: Array<{ label: string; items: string[] }> }) {
  const colClass =
    columns.length >= 4 ? "lg:grid-cols-4" :
    columns.length === 3 ? "lg:grid-cols-3" :
    columns.length === 2 ? "lg:grid-cols-2" :
    "lg:grid-cols-1";

  return (
    <div className={`mt-1.5 grid gap-1.5 ${colClass}`}>
      {columns.map((column) => (
        <div key={column.label} className="rounded-md bg-white px-2.5 py-1.5 shadow-sm ring-1 ring-slate-200/60">
          <p className="mb-1 text-[10px] font-black text-slate-500">{column.label}</p>
          <div className="space-y-1">
            {column.items.map((item) => (
              <p key={item} className="text-[10px] font-semibold leading-4 text-slate-600">{item}</p>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function PlanBullet({ item, tone }: { item: string; tone: (typeof PLAN_TONE_CLASS)[PlanPhase["accent"]] }) {
  return (
    <div className="flex gap-1.5 rounded-md bg-white px-2.5 py-1.5 shadow-sm ring-1 ring-slate-200/60">
      <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${tone.icon.split(" ")[0]}`} />
      <p className="text-[10px] font-semibold leading-4 text-slate-600">{item}</p>
    </div>
  );
}

function PlanMetricCard({ metric, tone }: { metric: PlanMetric; tone: (typeof PLAN_TONE_CLASS)[PlanPhase["accent"]] }) {
  return (
    <article className="rounded-xl border border-border/70 bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_16px_34px_rgba(15,23,42,0.075)]">
      <div className="flex items-start gap-2">
        {metric.code && <span className={`rounded-md px-2 py-1 text-xs font-black ${tone.badge}`}>{metric.code}</span>}
        <h4 className="min-w-0 flex-1 text-sm font-black leading-5 text-slate-950">{metric.name}</h4>
      </div>
      {metric.value && <p className="mt-3 text-2xl font-black tracking-tight text-slate-900">{metric.value}</p>}
      {metric.method && (
        <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
          <span className="text-slate-400">口径：</span>{metric.method}
        </p>
      )}
      {metric.target && (
        <p className="mt-2 text-xs font-semibold leading-5 text-slate-700">
          <span className="text-slate-400">目标：</span>{metric.target}
        </p>
      )}
      {metric.note && <p className="mt-2 text-xs leading-5 text-slate-500">{metric.note}</p>}
    </article>
  );
}

function PlanSectionCard({ section }: { section: PlanSection }) {
  return (
    <article className="rounded-xl bg-slate-50 p-4 ring-1 ring-border/70">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-black text-slate-900">{section.title}</h4>
        {section.deadline && (
          <span className="ml-auto rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-slate-500 ring-1 ring-border/70">
            {section.deadline}
          </span>
        )}
      </div>
      <div className="mt-3 space-y-2">
        {section.items.map((item) => (
          <div key={item} className="flex gap-2 rounded-lg bg-white px-3 py-2 ring-1 ring-border/60">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
            <p className="text-xs font-semibold leading-5 text-slate-600">{item}</p>
          </div>
        ))}
      </div>
    </article>
  );
}

function Stat({ label, value, muted }: { label: string; value: string | number; muted?: boolean }) {
  return (
    <div className="rounded-xl bg-card/80 py-2 text-center shadow-[0_6px_16px_rgba(15,23,42,0.04)] ring-1 ring-border/60">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`mt-0.5 text-2xl font-bold leading-none ${muted ? "text-muted-foreground" : "text-primary"}`}>{value}</p>
    </div>
  );
}

const PERSONAL_KPIS = [
  {
    tag: "核心 KPI",
    title: "考核利润",
    task: "推动产险整体利润达成",
    goal: "底线xxx亿、市场线xxx亿、计划线xxx亿、标杆线xxx亿",
    weight: "50%",
    self: 92.6,
    last: 92.6,
    current: "92.6",
    note: "底线xxx亿、市场线xxx亿、计划线xxx亿、标杆线xxx亿；权重50%。",
  },
  {
    tag: "核心 KPI",
    title: "份额提升",
    task: "提升核心业务市场份额",
    goal: "底线x%、市场线x%、计划线x%、标杆线xx%",
    weight: "25%",
    self: 89.5,
    last: 89.5,
    current: "89.5",
    note: "底线x%、市场线x%、计划线x%、标杆线xx%；权重25%。",
  },
  {
    tag: "核心 KPI",
    title: "COR优于市场",
    task: "保持成本率优于市场",
    goal: "底线x%、市场线x%、计划线x%、标杆线xx%",
    weight: "25%",
    self: 92,
    last: 92,
    current: "92",
    note: "底线x%、市场线x%、计划线x%、标杆线xx%；权重25%。",
  },
];

const PERSONAL_KEY_WORK = [
  {
    tag: "关键工作",
    title: "企康",
    goal: "按集团统一要求；时间计划2026-12-31",
    weight: "-",
    self: 80,
    last: 80,
    current: "80",
    note: "按集团统一要求；时间计划2026-12-31。",
  },
  {
    tag: "关键工作",
    title: "综合金融",
    goal: "按集团统一要求；时间计划2026-12-31",
    weight: "-",
    self: 80,
    last: 80,
    current: "80",
    note: "按集团统一要求；时间计划2026-12-31。",
  },
  {
    tag: "关键工作",
    title: "管理净利润",
    goal: "XX亿；时间计划2026-12-31",
    weight: "-",
    self: 80,
    last: 80,
    current: "80",
    note: "XX亿；时间计划2026-12-31。",
  },
  {
    tag: "关键工作",
    title: "投资收益",
    goal: "XX亿；时间计划2026-12-31",
    weight: "-",
    self: 80,
    last: 80,
    current: "80",
    note: "XX亿；时间计划2026-12-31。",
  },
  {
    tag: "关键工作",
    title: "HS规模",
    goal: "XX亿；时间计划2026-12-31",
    weight: "-",
    self: 80,
    last: 80,
    current: "80",
    note: "XX亿；时间计划2026-12-31。",
  },
  {
    tag: "关键工作",
    title: "ROE",
    goal: "0.13；时间计划2026-12-31",
    weight: "-",
    self: 80,
    last: 80,
    current: "80",
    note: "0.13；时间计划2026-12-31。",
  },
  {
    tag: "关键工作",
    title: "非车发展——非车业务占比、非车COR",
    goal: "业务占比≥34%，COR≤99.5%；时间计划2026-12-31",
    weight: "-",
    self: 80,
    last: 80,
    current: "80",
    note: "业务占比≥34%，COR≤99.5%；时间计划2026-12-31。",
  },
  {
    tag: "关键工作",
    title: "车险两地牌照一体化管理",
    goal: "根据集团要求，4月底前汇报马总；时间计划2026-12-31。市场洞察：香港车险54亿、增长基本停滞（0.1%），成本亏损（101%）；两地车市场天花板明显（2030年10.7亿），港车北上私家车客户打通两地车险后成本盈利，依托内地服务网络和数字化能力，可作为抢占香港车险市场切入点，助力平安香港增长。战略目标：短期（2027年）两地车市场份额提升至30%；长期（2030年）香港产险私家车份额跻身市场前列。核心举措：短期创新获客、搭建引流专区、打造一站式服务IP；长期依托内地核心能力，从获客、定价、理赔、留存等6大领域赋能平安香港。",
    weight: "-",
    self: 80,
    last: 80,
    current: "80",
    note: "市场洞察：香港车险54亿、增长基本停滞（0.1%），成本亏损（101%）；两地车市场天花板明显（2030年10.7亿），港车北上私家车客户打通两地车险后成本盈利，依托内地服务网络和数字化能力，可作为抢占香港车险市场切入点，助力平安香港增长。战略目标：短期（2027年）两地车市场份额提升至30%；长期（2030年）香港产险私家车份额跻身市场前列。核心举措：短期创新获客、搭建引流专区、打造一站式服务IP；长期依托内地核心能力，从获客、定价、理赔、留存等6大领域赋能平安香港。",
  },
  {
    tag: "关键工作",
    title: "非车发展策略",
    goal: "时间计划2026-12-31。健康险（个人）：个健康200亿，超市场7pt，份额19.0%；保单成本率92.5%；百万医客户数1212万。宠物险：市场份额16%；两率≤102%；服务客户数200万；服务GMV3000万元。小微综合保险业务：规模增速15%，规模70亿。企康：新增客户央国企规模占比90%；千万以上客户到企活动覆盖率80%。健康险进展：4月保费68.7亿，保单成本率91.6%，百万医客户434万；上线普惠版慢病产品、乳腺癌复发专属定价模型、肺结节及AD症加购包；推广减重行动，累计参与114万人。宠物险进展：4月保费8580万，成本102.9%，服务客户67万，GMV610万；搭建理赔作业中心、打击黑产；联名银行发行宠物信用卡；北上广深杭推出高端宠物托管服务；湖北试点萌宠卡、重庆创新营销模式。小微综合保险业务进展：4月保费22.7亿，增速21%；推出“企无忧”“平安惠企保”；上线连锁餐饮行业智能平台。企康进展：4月新增央国企客户占比94%，千万客户活动覆盖率68%；推动122家一级央企落地，新落地3家；下发标杆SOP，圈定重点客户推进运营。",
    weight: "-",
    self: 80,
    last: 80,
    current: "80",
    note: "健康险（个人）：个健康200亿，超市场7pt，份额19.0%；保单成本率92.5%；百万医客户数1212万。宠物险：市场份额16%；两率≤102%；服务客户数200万；服务GMV3000万元。小微综合保险业务：规模增速15%，规模70亿。企康：新增客户央国企规模占比90%；千万以上客户到企活动覆盖率80%。健康险进展：4月保费68.7亿，保单成本率91.6%，百万医客户434万；上线普惠版慢病产品、乳腺癌复发专属定价模型、肺结节及AD症加购包；推广减重行动，累计参与114万人。宠物险进展：4月保费8580万，成本102.9%，服务客户67万，GMV610万；搭建理赔作业中心、打击黑产；联名银行发行宠物信用卡；北上广深杭推出高端宠物托管服务；湖北试点萌宠卡、重庆创新营销模式。小微综合保险业务进展：4月保费22.7亿，增速21%；推出“企无忧”“平安惠企保”；上线连锁餐饮行业智能平台。企康进展：4月新增央国企客户占比94%，千万客户活动覆盖率68%；推动122家一级央企落地，新落地3家；下发标杆SOP，圈定重点客户推进运营。",
  },
  {
    tag: "关键工作",
    title: "车险HS发展策略",
    goal: "潜客100万、主体覆盖率60%、机构渗透率60%；时间计划2026-12-31。4月进展：潜客30万、主体覆盖率54%、机构渗透率53%。扩大主体合作：新跑通建信、中银2家，累计合作33家，覆盖516个网点；推进再保分润，预计4月底签协议、7月系统出单。扩大渠道入口：推广合规代理人模式；下发流量分发模型，支持中小主体监控。搭建系统平台：4月22日上线2C保单服务功能；补充科技人力，推进2B平台建设。",
    weight: "-",
    self: 80,
    last: 80,
    current: "80",
    note: "4月进展：潜客30万、主体覆盖率54%、机构渗透率53%。扩大主体合作：新跑通建信、中银2家，累计合作33家，覆盖516个网点；推进再保分润，预计4月底签协议、7月系统出单。扩大渠道入口：推广合规代理人模式；下发流量分发模型，支持中小主体监控。搭建系统平台：4月22日上线2C保单服务功能；补充科技人力，推进2B平台建设。",
  },
  {
    tag: "关键工作",
    title: "压舱石提升",
    goal: "3年优质底仓占比与收益贡献超2/3，力争逆转NII下降趋势；时间计划2026-12-31。压舱石收益：4月末NII预估1.02%，全年预计2.6%。压舱石配置：占比70.6%；到期优质底仓减少113亿；新增配置249亿（固收253亿、另类净出资-4亿、OCI股占比9.7%）；储备229亿。劣质底仓处置：OCI债累计卖出49亿，浮亏降至5.6亿，后续择机处置。",
    weight: "-",
    self: 80,
    last: 80,
    current: "80",
    note: "压舱石收益：4月末NII预估1.02%，全年预计2.6%。压舱石配置：占比70.6%；到期优质底仓减少113亿；新增配置249亿（固收253亿、另类净出资-4亿、OCI股占比9.7%）；储备229亿。劣质底仓处置：OCI债累计卖出49亿，浮亏降至5.6亿，后续择机处置。",
  },
  {
    tag: "关键工作",
    title: "长护战略规划",
    goal: "配合集团战发，制定长护险业务战略规划，明确业务价值与开展路径；时间计划2026-12-31。K0目标：26年政保10亿、商保500万；30年政保288亿、商保4.3亿。K3关键工作：涵盖市场策略、销售支持、产品开发、考核及资源投入；细化政保10亿达成路径与营销体系，完善考核时间节点。",
    weight: "-",
    self: 80,
    last: 80,
    current: "80",
    note: "K0目标：26年政保10亿、商保500万；30年政保288亿、商保4.3亿。K3关键工作：涵盖市场策略、销售支持、产品开发、考核及资源投入；细化政保10亿达成路径与营销体系，完善考核时间节点。",
  },
];

const SUB_KPIS = [
  { tag: "核心 KPI", title: "个人承保利润", task: "推动个人承保利润目标达成", goal: "25年目标65亿，26年待定", weight: "20%", self: 84, last: 85, current: "85",
    note: "企划暂未提供本月预估数据。" },
  { tag: "核心 KPI", title: "个人份额提升", task: "提升个人业务市场份额", goal: "25年目标0.01pt，26年待定", weight: "20%", self: 80, last: 81, current: "81",
    note: "车险累计份额下降0.05pt，个非（新口径）累计份额下降0.61pt。" },
  { tag: "核心 KPI", title: "车险COR优于市场", task: "推动车险成本率优于市场", goal: "25年目标0pt，26年待定", weight: "20%", self: 85, last: 85, current: "85",
    note: "车险COR优于市场0.3pt。" },
  { tag: "核心 KPI", title: "车主客均非车保费增速", task: "提升车主客均非车保费", goal: "25年目标5pt，26年待定", weight: "20%", self: 85, last: 85, current: "85",
    note: "达成392.1元，同比提升7.3%。" },
  { tag: "核心 KPI", title: "个非COR", task: "控制个非业务成本率", goal: "25年目标96%，26年待定", weight: "10%", self: 85, last: 85, current: "85",
    note: "预估集团核COR97.8%。" },
  { tag: "核心 KPI", title: "企康", task: "推进企康业务目标", goal: "基于集团目标设置", weight: "10%", self: 80, last: 80, current: "80",
    note: "基于集团目标设置。" },
];

const SUB_KEY_WORK = [
  { tag: "关键工作", title: "企康服务运营", goal: "服务区县覆盖80%、客诉≤0.01%；B2C保费3200万，并升级服务、线上运营和基建能力。", weight: "-", self: 80, last: 83, current: "83",
    note: "网点覆盖率60%、投诉率0.018%，企康B2C非车保费1277.3万；推进自拓网点、线上运营迁移和B2C企业摸排。" },
  { tag: "关键工作", title: "K3-Hub&Spoke", goal: "主体覆盖率60%、机构渗透率60%、潜客100万，跑通2C/2B联盟经营和再保分销模式。", weight: "-", self: 79, last: 82, current: "82",
    note: "4月潜客30万，主体覆盖率54%，机构渗透率53%；新跑通建信/中银两家主体，2C平台0422上线保单服务基础功能。" },
  { tag: "关键工作", title: "K3-宠物险", goal: "市场份额16%、两率=102%、服务客户200万、服务GMV3000万元，并完善宠物险理赔和生态体系。", weight: "-", self: 78, last: 79, current: "79",
    note: "保费5263万，达成率132%；服务客户56万，达成率280%；服务GMV470万，达成率157%；推进理赔作业中心和宠物信用卡等生态建设。" },
  { tag: "关键工作", title: "K3-健康险", goal: "个健康200亿，超市场7pt，份额19.0%；保单成本率92.5%；百万医客户数1212万。", weight: "-", self: 84, last: 85, current: "85",
    note: "4月保费68.7亿，达成率102%；保单成本率91.6%，优于目标2.6pt；百万医客户数434万，达成率103%。" },
  { tag: "关键工作", title: "万佛朝综", goal: "推进个非战役、万能服务、公域入口改版和AI医生使用。", weight: "-", self: 82, last: 85, current: "85",
    note: "4月万能服务明星口令词活动促活跃环比提升，万佛首页完成AI入口与非车推荐模型升级，AI医生咨询累计343万。" },
  { tag: "关键工作", title: "车险自助", goal: "全年自助率15.0%，培育自助意愿并推动机构分类发展。", weight: "-", self: 80, last: 83, current: "83",
    note: "4月车险自助率14.1%，同比提升5.0pt，超预期目标0.6pt；机构自助意愿持续提升，25家机构制定差异化PTO利益分配规则。" },
  { tag: "关键工作", title: "个人客户经营", goal: "通过自助、留存、加购、协销支撑三数达成，并完善客户经营价值核算体系。", weight: "-", self: 80, last: 80, current: "80",
    note: "累计留存率75.9%，当月自助率14.4%，4月滚动一年加购率41.3%，拼多多累计转化60.2万人。" },
  { tag: "关键工作", title: "数字营销", goal: "企划保费17.6亿、公域ROI达到2.5、打造10个百万粉丝头部账号。", weight: "-", self: 80, last: 83, current: "83",
    note: "公私域4月非车企划达成1.12亿，增速158.6%，公域ROI 2.37，达成率103%。" },
  { tag: "关键工作", title: "AI in ALL", goal: "AI贡献保费收入48亿，智能核保AI减损5.2亿，打造智小安、万能销售和智能核保能力。", weight: "-", self: 80, last: 85, current: "85",
    note: "智小安AI问题解决率86.7%，AI转化保费5亿；万能销售AI贡献保费6.6亿；智能核保AI采纳率60.4%，AI减损1.18亿。" },
];

type AnnualPlanItem = (typeof PERSONAL_KPIS | typeof PERSONAL_KEY_WORK | typeof SUB_KPIS | typeof SUB_KEY_WORK)[number];

function PlanIndicators({ showHeader = true }: { showHeader?: boolean }) {
  const [kpiOpen, setKpiOpen] = useState(true);
  const [keyOpen, setKeyOpen] = useState(true);
  return (
    <div>
      {showHeader && (
        <div className="flex items-center gap-2 mb-3">
          <span className="h-1 w-4 bg-primary rounded-full" />
          <h4 className="text-sm font-semibold">年度计划指标</h4>
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
            {SUB_KPIS.length} 项 KPI · {SUB_KEY_WORK.length} 项关键工作
          </span>
        </div>
      )}

      <PlanGroup
        title="核心 KPI"
        count={SUB_KPIS.length}
        open={kpiOpen}
        onToggle={() => setKpiOpen((v) => !v)}
        items={SUB_KPIS}
        kind="kpi"
      />
      <div className="h-3" />
      <PlanGroup
        title="关键工作"
        count={SUB_KEY_WORK.length}
        open={keyOpen}
        onToggle={() => setKeyOpen((v) => !v)}
        items={SUB_KEY_WORK}
        kind="work"
      />
    </div>
  );
}

function PlanGroup({
  title, count, open, onToggle, items, kind,
}: {
  title: string; count: number; open: boolean; onToggle: () => void;
  items: AnnualPlanItem[];
  kind: "kpi" | "work";
}) {
  return (
    <div>
      <button onClick={onToggle} className="w-full flex items-center gap-2 rounded-xl px-3 py-2.5 hover:bg-secondary/45 transition">
        <span className="text-sm font-semibold">{title}</span>
        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{count} 项</span>
        <ChevronDown className={`h-4 w-4 ml-auto text-muted-foreground transition-transform ${open ? "" : "-rotate-90"}`} />
      </button>
      {open && (
        <div className="space-y-3">
          {items.map((it) => (
            <PlanCard key={it.title} item={it} kind={kind} />
          ))}
        </div>
      )}
    </div>
  );
}

const HISTORY: { period: string; note: string; supervisor: string; source: string }[] = [
  { period: "2026-03", note: "产险经营保持稳健，监管沟通和风险减量工作持续推进。", supervisor: "持续强化新客增长、企康委托和重点机构改善。", source: "汇报系统 · 2026-04-06" },
  { period: "2026-02", note: "核心业务节奏清晰，重点工作逐步进入跟踪闭环。", supervisor: "关注业务补缺和经营风险前置识别。", source: "汇报系统 · 2026-03-05" },
  { period: "2026-01", note: "年度工作启动，产险重点项目按集团要求拆解。", supervisor: "推进重点任务台账化管理。", source: "汇报系统 · 2026-02-05" },
];

function PlanCard({ item, kind }: { item: AnnualPlanItem; kind: "kpi" | "work" }) {
  const [goalExpanded, setGoalExpanded] = useState(false);
  const Icon = kind === "kpi" ? Target : BriefcaseBusiness;
  const canToggleGoal = item.goal.length > 42;

  return (
    <div className="group rounded-2xl bg-white px-4 py-3.5 shadow-[0_12px_28px_rgba(15,23,42,0.055)] ring-1 ring-border/70 transition hover:-translate-y-0.5 hover:shadow-[0_18px_36px_rgba(15,23,42,0.09)] hover:ring-primary/18">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 h-8 w-8 rounded-lg flex items-center justify-center shrink-0 shadow-inner ${
          kind === "kpi" ? "bg-primary-soft text-accent-foreground" : "bg-success-soft text-success"
        }`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <p className="text-sm font-semibold leading-tight flex-1">{item.title}</p>
            {kind === "kpi" && (
              <span className="rounded-full bg-primary-soft px-2 py-0.5 text-[11px] font-semibold text-accent-foreground shrink-0">
                权重 {item.weight}
              </span>
            )}
          </div>
          <div className="mt-2 space-y-1.5">
            {kind === "kpi" && "task" in item && (
              <p className="text-xs text-foreground/75 leading-relaxed">任务：{item.task}</p>
            )}
            <div className="flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
              <span className="shrink-0">目标：</span>
              <p className={`min-w-0 flex-1 ${canToggleGoal && !goalExpanded ? "line-clamp-1" : ""}`}>
                {item.goal}
              </p>
              {canToggleGoal && (
                <button
                  type="button"
                  onClick={() => setGoalExpanded((v) => !v)}
                  aria-label={goalExpanded ? "收起目标" : "展开目标"}
                  className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-accent-foreground"
                >
                  <ChevronDown className={`h-3.5 w-3.5 transition-transform ${goalExpanded ? "rotate-180" : ""}`} />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PlanCol({ label, value, bold, highlight, span = 2 }: { label: string; value: string | number; bold?: boolean; highlight?: boolean; span?: number }) {
  const spanCls: Record<number, string> = { 2: "col-span-2", 3: "col-span-3", 4: "col-span-4" };
  return (
    <div className={`${spanCls[span]} ${highlight ? "rounded-md bg-warning-soft/40 px-1.5 py-1" : ""}`}>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`mt-0.5 ${bold ? "text-base font-bold" : "text-sm font-medium"} ${value === "—" || value === "-" ? "text-muted-foreground" : ""}`}>{value}</p>
    </div>
  );
}

function FeedbackItem({ label, color, text }: { label: string; color: "success" | "warning" | "primary"; text: string }) {
  const colorMap = {
    success: "text-success",
    warning: "text-warning",
    primary: "text-accent-foreground",
  };
  const dotMap = {
    success: "bg-success",
    warning: "bg-warning",
    primary: "bg-primary",
  };
  return (
    <div className="rounded-2xl border border-white/70 bg-white/60 p-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.045)] backdrop-blur-md">
      <p className={`flex items-center gap-2 text-xs font-semibold ${colorMap[color]}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${dotMap[color]}`} />
        {label}
      </p>
      <p className="text-sm mt-1 leading-relaxed">{text}</p>
    </div>
  );
}

/* ===================== AI ASSISTANT ===================== */

const SUGGESTIONS = [
  { id: "missing_reports", text: "本月哪些下属还未提交汇报？" },
  { id: "team_kpi", text: "帮我分析团队KPI完成情况" },
  { id: "zhou_trend", text: "查看丁珂珂的历史评价趋势" },
] as const;
type SuggestionId = (typeof SUGGESTIONS)[number]["id"];
const RECOMMENDED_PROMPT_LIMIT = 3;

const MONTHLY_REPORT_SUMMARY_GUIDE_STEPS = [
  {
    id: "annual-plan",
    title: "制定计划",
    subtitle: "上级与下属共同确定年度核心KPI、关键工作",
    icon: ListChecks,
    tone: "from-[#2563eb] via-[#60a5fa] to-[#14b8a6]",
    badge: "年度计划",
    headline: "制定和讨论年度计划：核心KPI + 关键工作",
    sections: [
      { title: "核心KPI", items: ["计划包括核心KPI及关键工作，需定义清晰、可追踪考核。", "核心KPI建议3-5项，并设置权重。"] },
      { title: "关键工作", items: ["承接核心考核指标，明确时间要求、评价/评分标准。"] },
      { title: "业务单位", items: ["以年度业务计划为核心，关键工作围绕任务计划达成要求落地追踪。"] },
      { title: "非业务单位", items: ["抓住核心和关键工作，定性、定量、定时必须清晰。"] },
    ],
  },
  {
    id: "summary-structure",
    title: "内容结构",
    subtitle: "每月5日前书面报告月度工作",
    icon: ClipboardList,
    tone: "from-[#0ea5e9] via-[#60a5fa] to-[#14b8a6]",
    badge: "填报结构",
    headline: "月度绩效总结指引：达成自评 + 综合汇报",
    sections: [
      { title: "时间频次", items: ["下属每月5日前书面报告月度工作。"] },
      { title: "核心KPI及关键工作达成自评", items: ["含各指标具体工作进展及自评分。"] },
      { title: "综合汇报", items: ["含重点工作进展、存在不足、下月工作计划。"] },
      { title: "传导目标", items: ["持续追踪落实个人年度计划，层层传导，切实保障战略落地。"] },
    ],
  },
  {
    id: "summary-self-score",
    title: "达成自评",
    subtitle: "全面客观总结进展，评分按100分制",
    icon: Star,
    tone: "from-[#2563eb] via-[#7dd3fc] to-[#14b8a6]",
    badge: "100分制",
    headline: "核心KPI及关键工作达成自评",
    sections: [
      { title: "汇报要求", items: ["全面客观总结本月各项工作进展。", "无进展指标可直接说明，评分按100分制。"] },
      { title: "自评分标准参考", items: ["90-100分：杰出（超出上级预期）。", "80-90分：优秀（完成不错）。", "70-80分：良好（略显不足）。", "60-70分：基本合格。", "60分以下：不达标（基本不满意）。"] },
      { title: "进展标杆案例", items: ["核心KPI-月末人力（自评分78分）：截止4月，人力达成**万，同比-**%，达成率**%。", "关键工作-投产管理（自评分83分）：迭代机构投产监控体系，完成总部各项目投产风险检视，分析Q1费用投产并对重点项目预警，持续优化投产比。", "关键工作-风险预防（自评分80分）：本月无风险事件。"] },
    ],
  },
  {
    id: "summary-comprehensive",
    title: "综合汇报",
    subtitle: "重点进展、不足和下月计划必须完整",
    icon: FileText,
    tone: "from-[#3b82f6] via-[#a78bfa] to-[#14b8a6]",
    badge: "案例写法",
    headline: "综合汇报：全面客观，避免报喜不报忧",
    sections: [
      { title: "汇报要求", items: ["全面客观总结本月核心重点工作进展、存在不足及下月工作计划。", "避免报喜不报忧与形式主义。"] },
      { title: "重点工作进展", items: ["越权治理专项、腾讯网关持续测试、创保打样及26年整体规划已汇报，持续推进。"] },
      { title: "存在不足", items: ["2月5日DPP的HBase异常暴露出科技GBD运维管理及该集群双活问题。"] },
      { title: "下月工作计划", items: ["3月2日前联合数智、架构及科技召开专项复盘会议。", "跟进科技变更管理、问题处理及HBase集群双活问题，4月15日前演练一次。"] },
    ],
  },
] as const satisfies readonly GuideStep[];

const MONTHLY_REPORT_FEEDBACK_GUIDE_STEPS = [
  {
    id: "monthly-feedback-structure",
    title: "内容结构",
    subtitle: "每月10日前书面反馈+面谈，书面为主",
    icon: ClipboardList,
    tone: "from-[#2563eb] via-[#60a5fa] to-[#14b8a6]",
    badge: "反馈模板",
    headline: "月度绩效反馈指引：内容完整，避免形式主义",
    sections: [
      { title: "时间频次", items: ["下属每月5日前书面报告月度工作。", "上级每月10日前进行月度书面反馈+面谈，书面为主。"] },
      { title: "内容结构", items: ["具体参考左侧模板，需简单扼要，避免形式主义，要素完整。"] },
      { title: "必须包含", items: ["综合评分、核心KPI/关键工作评分。", "工作亮点。", "存在不足。", "下月重点工作。"] },
    ],
  },
  {
    id: "monthly-feedback-score",
    title: "评分标准",
    subtitle: "按100分制，评分完整、合理，拉开差距",
    icon: Star,
    tone: "from-[#2563eb] via-[#7dd3fc] to-[#14b8a6]",
    badge: "100分制",
    headline: "绩效评分：避免手松，体现差距",
    sections: [
      { title: "评分要求", items: ["按100分制。", "评分完整、合理，拉开差距，避免手松。"] },
      { title: "标准参考", items: ["90-100分：杰出（超出预期）。", "80-90分：优秀（完成不错）。", "70-80分：良好（略显不足）。", "60-70分：基本合格。", "60分以下：不达标（基本不满意，需特别提示）。"] },
    ],
  },
  {
    id: "monthly-feedback-highlight",
    title: "工作亮点",
    subtitle: "简单扼要，有数据支撑",
    icon: FileText,
    tone: "from-[#0ea5e9] via-[#60a5fa] to-[#14b8a6]",
    badge: "亮点案例",
    headline: "工作亮点：评价具体，有事实和数据支撑",
    sections: [
      { title: "反馈要求", items: ["简单扼要。", "有数据支撑。"] },
      { title: "标杆案例", items: ["车险市场份额提升显著：累计考核超市场*pt，HS增速贡献*%，展现较强的市场竞争力和业务规划能力。", "数字营销表现突出：创保获新保费全国第一，公域和私域保费产出表现亮眼，展现较强的数字化营销和市场拓展能力。"] },
    ],
  },
  {
    id: "monthly-feedback-shortcoming",
    title: "存在不足",
    subtitle: "一针见血，穿透表面问题，定位根源",
    icon: AlertCircle,
    tone: "from-[#2563eb] via-[#38bdf8] to-[#14b8a6]",
    badge: "不足案例",
    headline: "存在不足：指出问题与根因",
    sections: [
      { title: "反馈要求", items: ["一针见血。", "有数据支撑，穿透表面问题，定位根源。"] },
      { title: "标杆案例", items: ["企康开门红计划达成率低：截至2月，预估开门红计划达成率仅**%，重点项目签约和客户拜访进度需加快。", "HS发展存在体能和主体隐患：HS业务**%来自单一主体，其他主体合作进展缓慢，需优化主体结构和合作策略。"] },
    ],
  },
  {
    id: "monthly-feedback-next",
    title: "下月重点工作",
    subtitle: "紧密结合年初计划，定量要求/路径/时间/优先级清晰",
    icon: Clock3,
    tone: "from-[#3b82f6] via-[#a78bfa] to-[#14b8a6]",
    badge: "下月部署",
    headline: "下月重点工作：清晰、可追踪",
    sections: [
      { title: "反馈要求", items: ["紧密结合年初计划。", "定量要求、路径、时间、优先级清晰，可追踪。"] },
      { title: "标杆案例", items: ["加快企康重点项目推进：3月完成**项目签约打款，确保一季度白名单客户拜访率100%；加强企康业务拓展，优化项目资源配置，提升开门红计划达成率。", "优化HS合作与产出：3月15日前完成与**新增主体的合作签约，拓宽HS业务来源；同步建立主体业绩监控机制，每月定期追踪主体达成情况，优化政策支持，提升整体HS业务稳定性。"] },
    ],
  },
] as const satisfies readonly GuideStep[];

const MONTHLY_GUIDES = {
  summary: {
    title: "月度绩效总结指南",
    shortTitle: "总结指南",
    subtitle: "写汇报时查阅：年度计划、达成自评、综合汇报、自评分和案例",
    source: "月度汇报填报反馈指南/月度绩效总结指南",
    steps: MONTHLY_REPORT_SUMMARY_GUIDE_STEPS,
  },
  feedback: {
    title: "月度绩效反馈指南",
    shortTitle: "反馈指南",
    subtitle: "管理者反馈审批时查阅：评分、亮点、不足、下月重点和案例",
    source: "月度汇报填报反馈指南/月度绩效反馈指南",
    steps: MONTHLY_REPORT_FEEDBACK_GUIDE_STEPS,
  },
} as const;

const MIDYEAR_REPORT_SUMMARY_GUIDE_STEPS = [
  {
    id: "midyear-structure",
    title: "内容结构",
    subtitle: "半年/年度书面报告阶段工作",
    icon: ClipboardList,
    tone: "from-[#2563eb] via-[#60a5fa] to-[#14b8a6]",
    badge: "年中总结",
    headline: "年中/年度绩效总结指引：三块内容",
    sections: [
      { title: "时间频次", items: ["下属半年/年度书面报告阶段工作。"] },
      { title: "核心KPI及关键工作达成自评", items: ["含各指标具体工作进展及自评分。"] },
      { title: "主要贡献及亮点", items: ["根据个人半年/年度表现，详细填写“四新”自评。"] },
      { title: "不足及遗憾", items: ["坦诚自评不足之处，深刻剖析，至少填写3点。"] },
    ],
  },
  {
    id: "midyear-self-score",
    title: "达成自评",
    subtitle: "全面客观总结各项工作进展，评分按100分制",
    icon: Star,
    tone: "from-[#2563eb] via-[#7dd3fc] to-[#14b8a6]",
    badge: "100分制",
    headline: "核心KPI及关键工作达成自评",
    sections: [
      { title: "汇报要求", items: ["全面客观总结各项工作进展。", "评分按100分制。"] },
      { title: "自评分标准参考", items: ["90-100分：杰出（超出上级预期）。", "80-90分：优秀（完成不错）。", "70-80分：良好（略显不足）。", "60-70分：基本合格。", "60分以下：不达标（基本不满意）。"] },
      { title: "进展标杆案例", items: ["核心KPI-NBEV（自评分81分）：截至6月底，NBEV达成**亿，同比增长**%，目标达成率102%。", "关键工作-销售队伍训战赋能（自评分78分）：系统性锻造“文臣武将”干部梯队，上半年共开展6期初中阶“武将”集训，覆盖***人次，聚焦网点负责人、三级机构总等关键岗位培养，强化干部年轻化、实战化、复合化培养。"] },
    ],
  },
  {
    id: "midyear-contribution",
    title: "主要贡献及亮点",
    subtitle: "详细填写“四新”自评，至少填写1条",
    icon: FileText,
    tone: "from-[#0ea5e9] via-[#60a5fa] to-[#14b8a6]",
    badge: "四新",
    headline: "主要贡献及亮点：新业绩、新贡献、新创新、新提升",
    sections: [
      { title: "汇报要求", items: ["根据个人半年/年度表现，详细填写“四新”自评。", "至少填写1条。"] },
      { title: "四新释义", items: ["新业绩：指个人在业绩、工作上的新成果。", "新贡献：指对组织和团队的卓越贡献，促进组织达成优异成绩，同时对团队和他人有帮助。", "新创新：指在工作中提出的创新想法、组织开展的创新项目、取得的创新成果等。", "新提升：指个人在工作能力、技能、综合素质上不同于以往的新提升。"] },
      { title: "标杆案例", items: ["新业绩：1-6月新品FYP贡献**亿，分红险显著上量，贡献率达**%。", "新贡献：通过系统性宣导，参与多家大型银行高规格培训项目，有效提升平安品牌影响力。", "新创新：打造“**养老解决方案”，百万FYP单品达***件，形成市场领先的养老综合解决方案。", "新提升：银保化新权益体系，牵引约50%千万级客户完成保费跃迁，成为业务增长的重要引擎。"] },
    ],
  },
  {
    id: "midyear-shortcoming",
    title: "不足及遗憾",
    subtitle: "坦诚自评不足，深刻剖析，至少填写3点",
    icon: AlertCircle,
    tone: "from-[#3b82f6] via-[#a78bfa] to-[#14b8a6]",
    badge: "反思",
    headline: "不足及遗憾：写清差距、原因和后续动作",
    sections: [
      { title: "汇报要求", items: ["坦诚自评不足之处。", "深刻剖析，至少填写3点。"] },
      { title: "标杆案例", items: ["寿险“1+N”风险全景地图部分领域覆盖深化程度不足：受人力和队伍知识结构影响，投资、资负等专业领域模块仍较薄弱，后续拟通过招聘及培训持续改善队伍知识结构，聚焦重点领域与关键环节，持续深化风险识别颗粒度，推动风险地图向“精准穿透”升级。", "稽核自动化及智能化覆盖率仍有待提升：自动化部署平台于二季度完成搭建，智能化应用尚处于探索阶段，技术与业务需求之间存在一定断层。下半年将强化业审融合，形成“研”与“用”的良性循环。"] },
    ],
  },
] as const satisfies readonly GuideStep[];

const MIDYEAR_REPORT_FEEDBACK_GUIDE_STEPS = [
  {
    id: "midyear-feedback-structure",
    title: "内容结构",
    subtitle: "书面反馈包含7大要素，需确保内容完整",
    icon: ClipboardList,
    tone: "from-[#2563eb] via-[#60a5fa] to-[#14b8a6]",
    badge: "7大要素",
    headline: "年中/年度绩效反馈指引：书面反馈 + 面谈",
    sections: [
      { title: "内容结构", items: ["下属书面报告年中/年度工作。", "上级进行书面反馈+面谈。", "书面反馈包含7大要素，需确保内容完整，避免形式主义。"] },
      { title: "7大要素", items: ["1 绩效评分。", "2 工作亮点。", "3 存在不足。", "4 后续改进建议。", "5 8Q+TEL。", "6 综合能力。", "7 发展趋势。"] },
    ],
  },
  {
    id: "midyear-feedback-score",
    title: "评分标准",
    subtitle: "按100分制，评分完整、合理，拉开差距",
    icon: Star,
    tone: "from-[#2563eb] via-[#7dd3fc] to-[#14b8a6]",
    badge: "100分制",
    headline: "绩效评分：合理拉开差距",
    sections: [
      { title: "评分要求", items: ["按100分制。", "评分完整、合理，拉开差距，避免手松。"] },
      { title: "标准参考", items: ["90-100分：杰出（超出预期）。", "80-90分：优秀（完成不错）。", "70-80分：良好（略显不足）。", "60-70分：基本合格。", "60分以下：不达标（基本不满意，需特别提示）。"] },
    ],
  },
  {
    id: "midyear-feedback-highlight",
    title: "工作亮点",
    subtitle: "简单扼要，有数据支撑",
    icon: FileText,
    tone: "from-[#0ea5e9] via-[#60a5fa] to-[#14b8a6]",
    badge: "亮点案例",
    headline: "工作亮点：用数据说明贡献",
    sections: [
      { title: "反馈要求", items: ["简单扼要。", "有数据支撑。"] },
      { title: "标杆案例", items: ["营收利润超额达标，结构优化成效显著：全年零售考核营收达成率**%，利润达成率**%，全行排名前列，高质量存款竞赛多次全行第一，负债端降本增效能力突出。", "零售信贷中收突破，自营产能翻倍提升：中收益贷款净增***亿，人产提升**万，组内第1；普惠贷款余额增长***亿，打破低收益依赖。"] },
    ],
  },
  {
    id: "midyear-feedback-improve",
    title: "后续重点工作",
    subtitle: "结合年初计划，定量要求/路径/时间/优先级清晰",
    icon: Clock3,
    tone: "from-[#3b82f6] via-[#a78bfa] to-[#14b8a6]",
    badge: "后续建议",
    headline: "后续重点工作：清晰可追踪",
    sections: [
      { title: "反馈要求", items: ["紧密结合年初计划。", "定量要求、路径、时间、优先级清晰，可追踪。"] },
      { title: "标杆案例", items: ["夯实客户质量，打赢价值客群攻坚战：2026年三季度前建设客户分层经营体系，按客户AUM设定提升路径，配套专项费用激励；联动对公条线深挖代发企业，代发高质量客户占比提升至**%；建立流失客户预警机制，对非标到期资金提前做好承接规划。", "重塑存款增长引擎，强化阵地经营：26年下半年每月开展网点三公里商户联盟活动，新增千元户渗透率提升至**%；将存款留存纳入客户经理KPI，对承接率低于**%的机构扣减费用；落地“个贷+财富”一站式服务模式，提升按揭客户AUM配置率。"] },
    ],
  },
  {
    id: "midyear-feedback-8q",
    title: "8Q+TEL",
    subtitle: "11个维度、22个标签识别人才",
    icon: ListChecks,
    tone: "from-[#2563eb] via-[#38bdf8] to-[#14b8a6]",
    badge: "A+/A-/B+/B-",
    headline: "8Q+TEL评价：严谨客观，避免手松手紧",
    sections: [
      { title: "评价要求", items: ["评价需客观严谨，避免手松手紧。"] },
      { title: "模型说明", items: ["8Q+TEL从11个维度、22个标签识别、评估人才，各维度内涵可参考优势项标签。"] },
      { title: "标准参考", items: ["各维度评价分A+、A-、B+、B-四档。", "评价为A-及以上的维度，需勾选具体优势项标签。", "综合评估在上述四档基础上增加“A-~B+”档位。", "A+：非常杰出，位于同类人群前5%。", "A-：较为突出，位于同类人群前20%。", "B+：满足底线，位于同类人群前70%。", "B-：不达要求，位于同类人群后30%。"] },
    ],
  },
  {
    id: "midyear-feedback-quality",
    title: "综合能力",
    subtitle: "严格参考标准及比例",
    icon: Target,
    tone: "from-[#0ea5e9] via-[#60a5fa] to-[#14b8a6]",
    badge: "胜任度",
    headline: "综合能力：客观评价胜任程度",
    sections: [
      { title: "评价要求", items: ["评价需客观严谨，严格参考标准及比例。"] },
      { title: "标准参考", items: ["超越胜任：远超当前岗位要求，有明显潜力可胜任更高岗位，审慎准入，原则上比例＜3%。", "完全胜任：完全达到岗位要求，原则上比例＜40%。", "基本胜任：基本达到岗位要求，但需要适当辅导，原则上比例＜50%。", "继续观察：无法满足岗位要求，属危险区域，需观察决定留用与否，比例小于10%。"] },
    ],
  },
  {
    id: "midyear-feedback-trend",
    title: "发展趋势",
    subtitle: "严格参考标准及比例",
    icon: ScanLine,
    tone: "from-[#3b82f6] via-[#7dd3fc] to-[#14b8a6]",
    badge: "趋势判断",
    headline: "发展趋势：箭头向上、持平、向下",
    sections: [
      { title: "评价要求", items: ["评价需客观严谨，严格参考标准及比例。"] },
      { title: "标准参考", items: ["箭头向上：未来一年内计划提拔；高潜力人员；业绩持续优秀；原则上考核前70%，且整体比例＜25%。", "箭头持平：未来一年能保持当前工作水准；临退5年、绩效尚可的非关键岗位。", "箭头向下：能力、态度持续不佳，且未来一年内有向下趋势；“准备退出”且为淘汰人员。"] },
    ],
  },
] as const satisfies readonly GuideStep[];

const MIDYEAR_GUIDES = {
  summary: {
    title: "年中绩效总结填写指南",
    shortTitle: "总结指南",
    subtitle: "写年中汇报时查阅：核心KPI、关键工作、贡献亮点、不足反思和附件",
    source: "月度汇报填报反馈指南/年中:終绩效总结指南",
    steps: MIDYEAR_REPORT_SUMMARY_GUIDE_STEPS,
  },
  feedback: {
    title: "年中绩效反馈指南",
    shortTitle: "反馈指南",
    subtitle: "管理者反馈审批时查阅：整体评价、亮点、不足、下阶段建议和审批意见",
    source: "月度汇报填报反馈指南/年中:年度绩效反馈指南",
    steps: MIDYEAR_REPORT_FEEDBACK_GUIDE_STEPS,
  },
} as const;

type MonthlyGuideHintField =
  | "summary"
  | "summaryKpi"
  | "summaryKeyWork"
  | "feedbackOverall"
  | "feedbackHighlights"
  | "feedbackShortcomings"
  | "feedbackNextFocus"
  | "feedbackScore";

const MONTHLY_GUIDE_HINTS: Record<MonthlyGuideHintField, { title: string; items: string[]; example?: string }> = {
  summary: {
    title: "综合汇报",
    items: ["全面客观总结本月重点工作进展、存在不足及下月工作计划。", "避免报喜不报忧和形式主义，问题与计划都要写清。"],
    example: "示例：重点工作进展、存在不足、下月工作计划分段呈现。",
  },
  summaryKpi: {
    title: "核心 KPI 达成自评",
    items: ["按年度核心 KPI 逐项写本月进展及自评分。", "写清数据、达成率、同比/环比；无进展指标直接说明原因。"],
    example: "示例：月末人力、自评分、同比和达成率。",
  },
  summaryKeyWork: {
    title: "关键工作达成自评",
    items: ["围绕年度关键工作说明本月实际动作、结果和风险。", "自评分按 100 分制，需与实际达成质量匹配。"],
    example: "示例：投产管理、风险预防、专项治理等本月进展。",
  },
  feedbackOverall: {
    title: "综合评价",
    items: ["反馈要简单扼要、要素完整，覆盖评分、亮点、不足和下月重点。", "评价应有数据支撑，穿透表面问题并定位根源。"],
    example: "示例：先给综合判断，再展开关键事实和改进要求。",
  },
  feedbackHighlights: {
    title: "工作亮点",
    items: ["亮点需具体、简明，并有数据或事实支撑。", "优先写超市场、达成率、项目突破、数字化能力等可验证结果。"],
    example: "示例：车险市场份额提升显著，HS 增速贡献突出。",
  },
  feedbackShortcomings: {
    title: "存在不足",
    items: ["不足要一针见血，有数据支撑，定位根源。", "避免泛泛说“还需提升”，要指出差距、影响和需改进的动作。"],
    example: "示例：开门红计划达成率低，重点项目签约和客户拜访进度需加快。",
  },
  feedbackNextFocus: {
    title: "下月重点工作",
    items: ["紧密结合年初计划，写清定量要求、路径、时间和优先级。", "计划需可追踪，最好包含截止日期、协同对象和预期结果。"],
    example: "示例：3 月完成项目签约打款，建立主体业绩监控机制。",
  },
  feedbackScore: {
    title: "评分标准",
    items: ["按 100 分制，评分完整、合理，拉开差距，避免手松。", "90-100 杰出，80-90 优秀，70-80 良好，60-70 基本合格，60 以下不达标。"],
  },
};

function buildMonthlyReportGuideResponse() {
  const renderGuide = (
    prefix: string,
    title: string,
    steps: typeof MONTHLY_REPORT_SUMMARY_GUIDE_STEPS | typeof MONTHLY_REPORT_FEEDBACK_GUIDE_STEPS,
  ) => [
    `${prefix}、${title}`,
    ...steps.flatMap((step, stepIndex) => [
      `${stepIndex + 1}. ${step.title}：${step.headline}`,
      `说明：${step.subtitle}`,
      ...step.sections.flatMap((section) => [
        `- ${section.title}`,
        ...section.items.map((item) => `  ${item}`),
      ]),
    ]),
  ].join("\n");

  return [
    "月度汇报填报反馈指南如下：",
    renderGuide("一", "月度绩效总结指南", MONTHLY_REPORT_SUMMARY_GUIDE_STEPS),
    renderGuide("二", "月度绩效反馈指南", MONTHLY_REPORT_FEEDBACK_GUIDE_STEPS),
  ].join("\n\n");
}

const MONTHLY_REPORT_GUIDE_RESPONSE = buildMonthlyReportGuideResponse();

function isMonthlyReportGuideRequest(instruction: string) {
  const compact = instruction.replace(/\s/g, "");
  return /指南|指引|怎么填|如何填|填报要求|反馈要求|评分标准|新手/.test(compact)
    && /(月度|月报|汇报|绩效|反馈)/.test(compact);
}

const DEFAULT_QUESTION_PROMPTS = [
  { text: "帮我总结下5月汇报", mode: "personal_scoring" },
  { text: "月度汇报填报反馈指南", guideAction: true },
  { text: "本月哪些下属还未提交汇报？", suggestionId: "missing_reports" },
  { text: "帮我分析团队KPI完成情况", suggestionId: "team_kpi" },
  { text: "查看丁珂珂的历史评价趋势", suggestionId: "zhou_trend" },
] as const;

const ASSESSMENT_QUESTION_PROMPTS = [
  { text: "帮我做下团队考核排名", assessmentAction: "ranking" },
] as const;

type PlanQuestionPrompt = {
  text: string;
  planId: PlanPhase["id"];
};

const PLAN_QUESTION_PROMPTS: PlanQuestionPrompt[] = PLAN_PHASES
  .filter((phase) => phase.id !== "K5" && phase.id !== "K6")
  .map((phase) => ({
    text: `帮我梳理${phase.id}：${phase.title}的关键关注点`,
    planId: phase.id,
  }));

type DefaultQuestionPrompt =
  | (typeof DEFAULT_QUESTION_PROMPTS)[number]
  | (typeof ASSESSMENT_QUESTION_PROMPTS)[number]
  | PlanQuestionPrompt;

type AssistantInsight = {
  id: SuggestionId;
  question: string;
};

type RankingBand = "前10%" | "前20%" | "前40%" | "前70%" | "后30%" | "后10%";

type TeamRankingRow = {
  id: string;
  name: string;
  title: string;
  kpiScore: number;
  rankNo: number;
  total: number;
  originalBand: RankingBand;
  currentBand: RankingBand;
  ability: "完全胜任" | "基本胜任";
  trend: "↑" | "→";
  adjustmentNote?: string;
  adjustmentAlert?: boolean;
};

type TeamRankingSession = {
  rows: TeamRankingRow[];
  adjustedCount: number;
  upCount: number;
  downCount: number;
  warning?: string;
  assistantNote: string;
};

const RANKING_BANDS: RankingBand[] = ["前10%", "前20%", "前40%", "前70%", "后30%", "后10%"];

const TEAM_ASSESSMENT_RANKING_PEOPLE: Array<{
  name: string;
  lookupName?: string;
  band: RankingBand;
  ability: TeamRankingRow["ability"];
  kpiScore: number;
}> = [
  { name: "史良洵", band: "前70%", ability: "基本胜任", kpiScore: 86.2 },
  { name: "丁珂", lookupName: "丁珂珂", band: "前10%", ability: "完全胜任", kpiScore: 109.81 },
  { name: "徐华", band: "前20%", ability: "完全胜任", kpiScore: 107.8 },
  { name: "张振勇", band: "前40%", ability: "基本胜任", kpiScore: 103.88 },
  { name: "徐霆", band: "前70%", ability: "基本胜任", kpiScore: 85.4 },
  { name: "韩宪君", band: "前40%", ability: "基本胜任", kpiScore: 103.2 },
  { name: "姜华", band: "前70%", ability: "基本胜任", kpiScore: 84.9 },
  { name: "曹敬之", band: "前70%", ability: "基本胜任", kpiScore: 84.5 },
  { name: "朱曦", band: "前20%", ability: "完全胜任", kpiScore: 106.6 },
  { name: "李亚男", band: "后30%", ability: "基本胜任", kpiScore: 78.8 },
];

function buildInitialTeamRanking(subs: Subordinate[]): TeamRankingSession {
  const rows = TEAM_ASSESSMENT_RANKING_PEOPLE.map((person, index) => {
    const matchedSub = subs.find((sub) => sub.name === (person.lookupName ?? person.name) || sub.name === person.name);
    const rankNo = index + 1;
    const title = matchedSub?.title ?? "产险总公司总经理助理";
    return {
      id: matchedSub?.id ?? `assessment-${index + 1}`,
      name: person.name,
      title,
      kpiScore: person.kpiScore,
      rankNo,
      total: TEAM_ASSESSMENT_RANKING_PEOPLE.length,
      originalBand: person.band,
      currentBand: person.band,
      ability: person.ability,
      trend: person.ability === "完全胜任" ? "↑" : "→",
    } satisfies TeamRankingRow;
  });

  return {
    rows,
    adjustedCount: 0,
    upCount: 0,
    downCount: 0,
    assistantNote: "已根据当前用户直接下属的 KPI 得分生成初步考核排名，可继续输入调档指令。",
  };
}

function normalizeRankingBand(text: string): RankingBand | null {
  const compact = text.replace(/\s/g, "");
  const matched = compact.match(/(前|后)(10|20|30|40|70)%?/);
  if (!matched) return null;
  const band = `${matched[1]}${matched[2]}%` as RankingBand;
  return RANKING_BANDS.includes(band) ? band : null;
}

function parseRankingBandOrdinal(text: string): RankingBand | null {
  const compact = text.replace(/\s/g, "");
  const matched = compact.match(/第?([1-6一二两三四五六])档/);
  if (!matched) return null;
  const numberMap: Record<string, number> = {
    "1": 1,
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
  };
  const index = numberMap[matched[1]] - 1;
  return RANKING_BANDS[index] ?? null;
}

function normalizeAssessmentPersonName(text: string) {
  return text.replace(/珂珂/g, "珂").replace(/[，。,.、]/g, "").trim();
}

function parseRankingAdjustment(instruction: string, rows: TeamRankingRow[]) {
  const compact = normalizeAssessmentPersonName(instruction.trim().replace(/\s/g, ""));
  if (/重置|恢复|还原/.test(compact)) return { type: "reset" as const };
  if (/确认|提交/.test(compact)) return { type: "submit" as const };

  const target = rows.find((row) => compact.includes(normalizeAssessmentPersonName(row.name)));
  if (!target) return null;

  const toBandMatch = compact.match(/(?:调(?:成|至|到|为)|改(?:成|至|到|为)|设(?:成|为)|变(?:成|为))(.+)$/);
  if (toBandMatch) {
    const ordinalBand = parseRankingBandOrdinal(toBandMatch[1]);
    if (ordinalBand) return { type: "set" as const, row: target, toBand: ordinalBand, alert: true };
    const toBand = normalizeRankingBand(toBandMatch[1]);
    if (toBand) return { type: "set" as const, row: target, toBand, alert: false };
  }

  const stepMatch = compact.match(/(上调|下调|升|降)(\d*)档?/);
  if (stepMatch) {
    const direction = stepMatch[1] === "上调" || stepMatch[1] === "升" ? "上调" : "下调";
    return {
      type: "step" as const,
      row: target,
      direction,
      steps: Number(stepMatch[2] || 1),
    };
  }

  return null;
}

function applyRankingInstruction(session: TeamRankingSession, instruction: string): TeamRankingSession {
  const parsed = parseRankingAdjustment(instruction, session.rows);
  if (!parsed) {
    return {
      ...session,
      warning: "未识别到有效调档对象或档位。请使用“把某某下调1档”或“把某某从前10%调成前20%”。",
      assistantNote: "我已保留当前排名结果，等待你重新输入调档指令。",
    };
  }

  if (parsed.type === "reset") {
    const rows = session.rows.map((row) => ({
      ...row,
      currentBand: row.originalBand,
      adjustmentNote: undefined,
      adjustmentAlert: undefined,
    }));
    return {
      rows,
      adjustedCount: 0,
      upCount: 0,
      downCount: 0,
      assistantNote: "已重置所有调档，排名恢复为 KPI 得分初排结果。",
    };
  }

  if (parsed.type === "submit") {
    return {
      ...session,
      warning: undefined,
      assistantNote: "已生成业绩排名最终结果，待接入正式考核接口后可提交到考核系统。",
    };
  }

  const bandIndex = RANKING_BANDS.indexOf(parsed.row.currentBand);
  const targetIndex = parsed.type === "set"
    ? RANKING_BANDS.indexOf(parsed.toBand)
    : bandIndex + (parsed.direction === "下调" ? parsed.steps : -parsed.steps);

  if (targetIndex < 0 || targetIndex >= RANKING_BANDS.length) {
    return {
      ...session,
      warning: "调节超档。请重新调节。",
      assistantNote: `${parsed.row.name}当前已在${parsed.row.currentBand}，无法继续${parsed.type === "step" ? parsed.direction : "调整到目标档位"}。`,
    };
  }

  const delta = Math.abs(targetIndex - bandIndex);
  if (delta > 2) {
    return {
      ...session,
      warning: "调节超档。请重新调节。",
      assistantNote: `${parsed.row.name}从${parsed.row.currentBand}调整到${RANKING_BANDS[targetIndex]}跨越${delta}档，超过本轮允许范围。`,
    };
  }

  if (delta === 0) {
    return {
      ...session,
      assistantNote: `${parsed.row.name}已在${parsed.row.currentBand}，无需调整。`,
    };
  }

  const nextBand = RANKING_BANDS[targetIndex];
  const rows = session.rows.map((row) => {
    if (row.id !== parsed.row.id) return row;
    return {
      ...row,
      currentBand: nextBand,
      adjustmentNote: `${parsed.row.currentBand} → ${nextBand}`,
      adjustmentAlert: parsed.type === "set" ? parsed.alert || delta === 2 : delta === 2,
    };
  });
  const direction = targetIndex < bandIndex ? "up" : "down";

  return {
    rows,
    adjustedCount: rows.filter((row) => row.currentBand !== row.originalBand).length,
    upCount: session.upCount + (direction === "up" ? 1 : 0),
    downCount: session.downCount + (direction === "down" ? 1 : 0),
    assistantNote: `已将${parsed.row.name}从${parsed.row.currentBand}${direction === "up" ? "上调" : "下调"}至${nextBand}，并重新返回排名结果。`,
  };
}

const KPI_SCORE_ITEMS = [
  { id: "k1", tag: "核心KPI", title: "个人承保利润", weight: "20%", w: 0.2, self: 84, last: 85 },
  { id: "k2", tag: "核心KPI", title: "个人份额提升", weight: "20%", w: 0.2, self: 80, last: 81 },
  { id: "k3", tag: "核心KPI", title: "车险COR优于市场", weight: "20%", w: 0.2, self: 85, last: 85 },
  { id: "k4", tag: "核心KPI", title: "车主客均非车保费增速", weight: "20%", w: 0.2, self: 85, last: 85 },
  { id: "k5", tag: "核心KPI", title: "个非COR", weight: "10%", w: 0.1, self: 85, last: 85 },
  { id: "k6", tag: "核心KPI", title: "企康", weight: "10%", w: 0.1, self: 80, last: 80 },
];
const KEY_WORK_SCORE_ITEMS = [
  { id: "w1", tag: "关键工作", title: "企康服务运营", self: 80, last: 83 },
  { id: "w2", tag: "关键工作", title: "K3-Hub&Spoke", self: 79, last: 82 },
  { id: "w3", tag: "关键工作", title: "K3-宠物险", self: 78, last: 79 },
  { id: "w4", tag: "关键工作", title: "K3-健康险", self: 84, last: 85 },
  { id: "w5", tag: "关键工作", title: "万佛朝综", self: 82, last: 85 },
  { id: "w6", tag: "关键工作", title: "车险自助", self: 80, last: 83 },
  { id: "w7", tag: "关键工作", title: "个人客户经营", self: 80, last: 80 },
  { id: "w8", tag: "关键工作", title: "数字营销", self: 80, last: 83 },
  { id: "w9", tag: "关键工作", title: "AI in ALL", self: 80, last: 85 },
];
const SCORE_ITEMS = [...KPI_SCORE_ITEMS, ...KEY_WORK_SCORE_ITEMS];

const SAMPLE_SUB_DATA_BY_ID: Record<string, SubData> = {
  "2": {
    sub_id: "2",
    name: "丁珂珂",
    monthly_report: {
      period: CURRENT_PERIOD,
      highlights: "车险年累计落后市场缺口缩小；小个非4月当月对标市场有改善；集团个金标签及策略完成上线；AI应用培训覆盖200余人。4月还推进个人事业群全国会、车险经营帮扶、HS项目、互联网车险模式梳理和AI组织升级。",
      shortcomings: "个旧提升对标人保仍有差距；HS合作主体集中度高、三级网点开单不足；众安数基拿回仍需跟进用足；个非新口径累计落后市场；K6组织相关工作需要加快。",
      next_plan: "确保车险及个非半年超市场，推进医疗险理赔、粤港跨境车险、信用卡权益和生命尊享托管等集团重点项目，做好监管沟通并加快HS模式突破、AI工具推广与K6组织相关工作。",
    },
    last_supervisor_feedback: {
      period: CURRENT_PERIOD,
      score: 85,
      highlights: "个非健康险创新取得进展；智小安AI工具得到监管及行业认可。",
      shortcomings: "车险及个非发展均存在一定问题；个全新客数达成不及预期；平台和线销模式变革较慢。",
      next_focus: "确保车险及个非半年超市场，推进集团重点项目，做好监管沟通、HS模式突破及能力建设，并加快AI与K6组织相关工作。",
    },
    work_emails: [
      { subject: "HS项目4月进展", from: "个人事业群", date: "2026-04-25", summary: "4月HS潜客累计31万，主体覆盖率和机构渗透率整体进度符合预期。" },
      { subject: "个非健康险创新复盘", from: "健康险团队", date: "2026-04-28", summary: "慢病、乳腺癌、肺结节、AD症等产品上线，专病和中移动模式经验已在多家机构推广。" },
    ],
    chat_messages: [
      { channel: "个人事业群经营群", date: "2026-04-22", summary: "同步车险问题机构帮扶、互联网车险模式梳理和AI组织升级安排。" },
      { channel: "HS专项群", date: "2026-04-29", summary: "强调合作主体集中度、三级网点开单不足及监管沟通后续动作。" },
    ],
  },
};

function getDefaultFeedbackScores() {
  return Object.fromEntries(SCORE_ITEMS.map((item) => [item.id, item.self])) as Record<string, number>;
}

type FeedbackHighlightKey = "highlights" | "shortcomings" | "nextFocus";
type MidyearRating = "A+" | "A-" | "B+" | "B-";
type MidyearCapability = "超越胜任" | "完全胜任" | "基本胜任" | "亟待观察";
type MidyearTrend = "箭头向上" | "箭头持平" | "箭头向下";

type MidyearFeedbackScoreRow = {
  id: string;
  title: string;
  goal: string;
  weight?: string;
  time?: string;
  annualReport: string;
  midyearReport: string;
  monthlyAvg: number;
  aiScore: number;
  supervisorScore: number;
  evidence: string;
};

type MidyearAbilityDimension = {
  id: string;
  label: string;
  description: string;
  score: MidyearRating;
  value: number;
  evidence: string;
};

type MidyearSupervisorFeedback = {
  kpiScores: MidyearFeedbackScoreRow[];
  keyWorkScores: MidyearFeedbackScoreRow[];
  contributionReview: string;
  regretReview: string;
  overall: {
    score: number;
    highlights: string;
    shortcomings: string;
    nextYearFocus: string;
  };
  model: {
    rating: MidyearRating;
    dimensions: MidyearAbilityDimension[];
    tags: string[];
  };
  capability: MidyearCapability;
  trend: MidyearTrend;
  evidence: string[];
};

const MIDYEAR_RATINGS: MidyearRating[] = ["A+", "A-", "B+", "B-"];
const MIDYEAR_CAPABILITIES: MidyearCapability[] = ["超越胜任", "完全胜任", "基本胜任", "亟待观察"];
const MIDYEAR_TRENDS: MidyearTrend[] = ["箭头向上", "箭头持平", "箭头向下"];
const MIDYEAR_ADVANTAGE_TAGS = [
  "反应敏捷",
  "教育背景",
  "亲和友善",
  "人际理解",
  "专业经验",
  "学术背景",
  "行业经验",
  "解决问题",
  "毅力坚韧",
  "执着抗压",
  "求新求变",
  "理性自驱",
  "文化认同",
  "忠诚可靠",
  "社会关系",
  "资源转化",
  "格局视野",
  "资源规划",
  "结果导向",
  "组织策划",
  "团队领导",
  "激情奋战",
];

const MIDYEAR_ABILITY_DIMENSIONS: Array<Omit<MidyearAbilityDimension, "score" | "value" | "evidence">> = [
  { id: "iq", label: "IQ 智商", description: "反应敏捷、教育背景" },
  { id: "eq", label: "EQ 情商", description: "亲和友善、人际理解" },
  { id: "pq", label: "PQ 专业商", description: "专业经验、学术背景" },
  { id: "eeq", label: "EEQ 经验商", description: "行业经验、解决问题" },
  { id: "aq", label: "AQ 逆商", description: "毅力坚韧、执着抗压" },
  { id: "aaq", label: "AAQ 态度商", description: "求新求变、理性自驱" },
  { id: "lq", label: "LQ 忠诚商", description: "文化认同、忠诚可靠" },
  { id: "sq", label: "SQ 组织商", description: "社会关系、资源转化" },
  { id: "t", label: "T 统筹", description: "格局视野、资源规划" },
  { id: "e", label: "E 销商", description: "结果导向、组织策划" },
  { id: "l", label: "L 带队伍", description: "团队领导、激情奋战" },
];

function getMidyearAbilityDimensionTags(dimension: Pick<MidyearAbilityDimension, "description">) {
  return dimension.description.split("、").map((tag) => tag.trim()).filter(Boolean);
}

function parseFeedbackRequest(instruction: string, subs: Subordinate[]) {
  const compact = instruction.replace(/\s/g, "");
  if (!/(写|生成|起草).{0,8}反馈|反馈.{0,8}(写|生成|起草)/.test(compact)) return null;
  const targetText = compact
    .replace(/^帮我/, "")
    .replace(/^(写|生成|起草)/, "")
    .replace(/的?反馈.*$/, "");
  return subs.find((sub) => {
    const name = sub.name.replace(/\s/g, "");
    return compact.includes(name) || (!!targetText && (name.includes(targetText) || targetText.includes(name)));
  }) ?? null;
}

function isPersonalReportRequest(instruction: string) {
  const compact = instruction.replace(/\s/g, "");
  const hasAction = /(总结|写|生成|起草|整理|输出)/.test(compact);
  const hasReport = /(汇报|月报|月度报告|绩效报告)/.test(compact);
  const isTrackingQuestion = /(未提交|没提交|哪些|谁|催办|提醒|团队)/.test(compact);
  return hasAction && hasReport && !isTrackingQuestion;
}

function getFeedbackOptimizationTargets(instruction: string) {
  const compact = instruction.replace(/\s/g, "");
  const itemIds = new Set<string>();
  if (/HS|Hub|Spoke|监管|联盟|再保|分润|机构运营/i.test(compact)) itemIds.add("w2");
  if (/AI|K6|组织|架构|转型|工具/.test(compact)) itemIds.add("w9");
  if (/新客|份额|车险|个非|半年超市场|追平/.test(compact)) {
    itemIds.add("k2");
    itemIds.add("w6");
  }
  if (/健康|医疗|理赔|两核/.test(compact)) itemIds.add("w4");
  if (/企康|服务|权益|信用卡|托管/.test(compact)) {
    itemIds.add("k6");
    itemIds.add("w1");
  }
  if (itemIds.size === 0) {
    itemIds.add("k2");
    itemIds.add("w2");
    itemIds.add("w9");
  }
  if (![...itemIds].some((id) => id.startsWith("k"))) itemIds.add("k2");
  if (![...itemIds].some((id) => id.startsWith("w"))) itemIds.add("w2");
  return [...itemIds];
}

function getInstructionScoreDelta(instruction: string) {
  if (/更严格|严厉|明显|大幅|下调|降低|扣分/.test(instruction)) return -3;
  if (/严格|不足|问题|风险/.test(instruction)) return -2;
  if (/肯定|鼓励|正向|突出|强化亮点|提高|上调/.test(instruction)) return 2;
  return 0;
}

function getInstructionScoreOverride(instruction: string) {
  const scoreMatch = instruction.match(/(?:评分|打分|分数|主考).{0,8}?(\d{2,3})\s*分?/);
  if (!scoreMatch) return undefined;
  return normalizeScore(scoreMatch[1]);
}

function stripPriorRevisionFragments(text: string) {
  return text
    .replace(/\s*已根据你的要求补充强调：[^。]*。/g, "")
    .replace(/\s*需进一步围绕“[^”]+”明确责任人、时间点和跟踪机制。/g, "")
    .replace(/\s*同时按“[^”]+”方向细化5月里程碑、机构追踪和复盘口径。/g, "")
    .replace(/\s*本版根据“[^”]+”[^。]*。/g, "")
    .replace(/\s*根据补充要求“[^”]+”[^。]*。/g, "")
    .trim();
}

function appendDistinctSentences(base: string, sentences: string[]) {
  const cleaned = stripPriorRevisionFragments(base);
  const suffix = sentences.filter((sentence) => sentence && !cleaned.includes(sentence));
  const normalizedBase = cleaned.endsWith("。") || cleaned.endsWith("；") ? cleaned : `${cleaned}。`;
  return `${normalizedBase}${suffix.join("")}`;
}

const FEEDBACK_REVISION_LIBRARY: Record<string, { highlight: string; shortcoming: string; next: string; note: string }> = {
  k1: {
    highlight: "利润表现需从承保质量、费用投放和赔付改善三个维度补充量化依据。",
    shortcoming: "承保利润仍需拆清增收、降赔和费用优化来源，避免只停留在结果描述。",
    next: "5月需建立利润拆解台账，按周复盘高赔业务、费用消耗和机构改善动作。",
    note: "利润项按经营质量从严校准，需补充承保质量、赔付改善和费用效率的闭环证据。",
  },
  k2: {
    highlight: "份额提升需要突出新能源、新车高增品牌和转保转化率的有效动作。",
    shortcoming: "新客和份额改善仍未形成稳定趋势，车主端与非车主端需分别给出补缺策略。",
    next: "5月需锁定新车高增品牌、转保链路和C/B/P客户分层策略，形成缺口追赶路线图。",
    note: "份额项需按新客、转保和客户分层拆解，5月底前明确缺口、责任人和追赶节奏。",
  },
  k3: {
    highlight: "COR优于市场需补充风控、定价和科技监管对结果的支撑。",
    shortcoming: "风险改善举措仍需量化到高赔业务治理和机构管控动作。",
    next: "5月需持续跟踪COR偏离机构，形成高风险业务治理清单和复盘机制。",
    note: "COR项按风险治理质量校准，需补充高赔机构治理和科技监管穿透证据。",
  },
  k4: {
    highlight: "车主客均非车保费增速需体现车险客户经营和交叉销售转化动作。",
    shortcoming: "车主非车转化链路还需提升，客群触达、权益匹配和销售转化需进一步拆解。",
    next: "5月需围绕车主客群经营建立权益包、触达节奏和转化漏斗复盘。",
    note: "车主客均非车项需补充客群经营、权益匹配和转化漏斗数据。",
  },
  k5: {
    highlight: "个非COR需补充产品结构、赔付趋势和定价优化的改善依据。",
    shortcoming: "个非业务增长和COR质量仍需平衡，需避免规模提升带来赔付压力。",
    next: "5月需按产品线跟踪个非COR，建立高风险产品调整和定价复盘机制。",
    note: "个非COR项需结合产品结构和赔付趋势从严评价。",
  },
  k6: {
    highlight: "企康需突出央国企客户突破、服务权益和托管服务落地。",
    shortcoming: "企康服务链路仍需补齐客户分层、权益触达和履约体验。",
    next: "5月需推进信用卡服务权益、生命尊严托管服务和重点客户运营台账。",
    note: "企康项需补充服务权益、重点客户运营和履约质量证据。",
  },
  w1: {
    highlight: "企康服务运营需体现权益设计、客户触达和服务履约闭环。",
    shortcoming: "服务运营仍需从权益上线转向可追踪的客户使用和满意度改善。",
    next: "5月需建立企康服务运营看板，跟踪权益触达、使用率和客户反馈。",
    note: "企康服务运营需按客户触达、权益使用和履约体验补充评价。",
  },
  w2: {
    highlight: "HS方向已跑通重点主体并推进2C、2B平台建设，需要突出监管沟通和联盟运营价值。",
    shortcoming: "HS仍面临同业反馈、地方监管沟通、再保分润和三级网点开单不足等约束。",
    next: "5月需形成分机构监管沟通清单，跑通再保分润试点，并建立联盟客户提前运营台账。",
    note: "HS项按监管沟通、再保分润、联盟运营和机构开单进度重新评价，里程碑需落到5月底。",
  },
  w3: {
    highlight: "宠物险需突出渠道合作、产品迭代和客户运营进展。",
    shortcoming: "宠物险规模增长与续保质量仍需同步提升，渠道转化效率要继续跟踪。",
    next: "5月需明确宠物险渠道转化、续保经营和产品优化节奏。",
    note: "宠物险项需补充渠道转化、续保质量和产品迭代证据。",
  },
  w4: {
    highlight: "健康险和医疗险理赔集中项目需突出两核智能化、专病产品和复制机制。",
    shortcoming: "健康险创新仍需提升标准化复制、理赔效率和机构落地一致性。",
    next: "5月需细化医疗险理赔集中、智能两核和专病产品复制的项目计划。",
    note: "健康险项需按产品创新、理赔集中和智能两核项目进度补充评价。",
  },
  w5: {
    highlight: "万佛朝综需体现综合金融协同和机构推动效率。",
    shortcoming: "综合协同还需补足机构动作穿透和过程指标追踪。",
    next: "5月需按机构建立协同项目清单，跟踪推进节奏和结果转化。",
    note: "综合协同项需补充机构穿透、过程指标和结果转化。",
  },
  w6: {
    highlight: "车险自助模式需突出全机构复制、平台线销转型和标准动作沉淀。",
    shortcoming: "自助模式推广仍不均衡，平台和线销部门的转型路径不够清晰。",
    next: "5月需明确全机构推广节奏、平台线销分工和标准动作验收口径。",
    note: "车险自助项需按全机构覆盖、标准动作和平台线销转型进度评价。",
  },
  w7: {
    highlight: "个人客户经营需突出用户需求研究、客户分层和经营逻辑优化。",
    shortcoming: "客户经营仍需从活动推动转向分层策略和持续转化。",
    next: "5月需按C/B/P客户制定差异化策略，补齐新客和转化缺口。",
    note: "个人客户经营需补充客户分层、需求研究和转化闭环。",
  },
  w8: {
    highlight: "数字营销需体现标签策略、触达效率和转化效果。",
    shortcoming: "数字营销仍需提升数据标签应用和经营动作的联动。",
    next: "5月需跟踪标签上线后的触达、转化和复购数据。",
    note: "数字营销项需按标签应用、触达效率和转化结果评价。",
  },
  w9: {
    highlight: "AI与K6组织工作需突出工具融入业务流程、机构使用和组织架构适配。",
    shortcoming: "AI工具推广仍需从培训覆盖转向真实使用，K6组织转型节奏需进一步加快。",
    next: "5月需明确AI工具高频场景、机构使用率和K6组织调整里程碑。",
    note: "AI in ALL项需按业务嵌入、机构使用率和K6组织转型里程碑重新评价。",
  },
};

function buildFeedbackScoreNotes(instruction: string, itemIds: string[]) {
  return Object.fromEntries(itemIds.map((id) => {
    const item = SCORE_ITEMS.find((scoreItem) => scoreItem.id === id);
    const title = item?.title ?? "该项";
    const library = FEEDBACK_REVISION_LIBRARY[id];
    const scoreTone = getInstructionScoreDelta(instruction) < 0
      ? "本次按更严格口径下调或压实评分。"
      : getInstructionScoreDelta(instruction) > 0
        ? "本次同步强化正向贡献和已完成成果。"
        : "本次保持评分口径，重点补充评价依据。";
    return [id, `${library?.note ?? `${title}需明确5月动作、责任跟进和可检查里程碑。`}${scoreTone}`];
  }));
}

function buildFeedbackRevisionContent(currentDraft: FeedbackDraft, instruction: string, itemIds: string[]) {
  const libraries = itemIds.map((id) => FEEDBACK_REVISION_LIBRARY[id]).filter(Boolean);
  const strict = getInstructionScoreDelta(instruction) < 0;
  const positive = getInstructionScoreDelta(instruction) > 0;
  const highlightSentences = libraries.map((item) => item.highlight);
  const shortcomingSentences = libraries.map((item) => item.shortcoming);
  const nextSentences = libraries.map((item) => item.next);

  if (strict) {
    shortcomingSentences.push("评分口径按更严格标准处理，未形成清晰里程碑、责任人和数据闭环的内容不再作为充分完成依据。");
  }
  if (positive) {
    highlightSentences.push("本版进一步突出已完成动作、阶段性成果和可复制经验。");
  }

  return {
    highlights: appendDistinctSentences(currentDraft.highlights, highlightSentences),
    shortcomings: appendDistinctSentences(currentDraft.shortcomings, shortcomingSentences),
    nextFocus: appendDistinctSentences(currentDraft.nextFocus, nextSentences),
  };
}

function buildManagerFeedbackDraft(
  data: SubData | null,
  name: string,
  score: number,
  refined = false,
): FeedbackDraft {
  const highlights = data?.monthly_report?.highlights || `${name}本月工作积极，沟通有效。`;
  const nextFocus = data?.monthly_report?.next_plan || "下月持续聚焦核心任务。";
  const shortcomings = refined
    ? `结合工作邮件与聊天记录分析：${data?.monthly_report?.shortcomings || "执行节奏可加强"}`
    : data?.monthly_report?.shortcomings || "部分领域仍有改进空间。";
  const resolvedHighlights = refined
    ? `${highlights}${data?.work_emails?.[0] ? `客户反馈："${data.work_emails[0].summary}"` : ""}`
    : highlights;
  const resolvedNextFocus = refined ? `${nextFocus}建议同步加强里程碑跟进。` : nextFocus;

  return {
    score,
    highlights: resolvedHighlights,
    shortcomings,
    nextFocus: resolvedNextFocus,
    scoreNotes: {},
    optimized: {},
    optimizedItemIds: [],
    feedbackText: `综合来看，${name}本月整体表现稳健，建议综合评分为 ${score} 分。${resolvedHighlights}\n\n需要继续关注的是：${shortcomings}\n\n后续建议围绕既定目标持续推进：${resolvedNextFocus}`,
  };
}

function buildMidyearSubReportSummary(sub: Subordinate) {
  const data = SAMPLE_SUB_DATA_BY_ID[sub.id];
  const highlights = data?.monthly_report?.highlights ?? "已提交年中总结，核心KPI和关键工作整体有阶段性进展。";
  const shortcomings = data?.monthly_report?.shortcomings ?? "部分目标和过程材料仍需补充事实依据。";
  const nextPlan = data?.monthly_report?.next_plan ?? "下阶段继续围绕核心目标推进，并补齐过程复盘和风险闭环。";
  return [
    `${sub.name}年中汇报摘要：`,
    `1. 核心成果：${highlights}`,
    `2. 不足及遗憾：${shortcomings}`,
    `3. 下阶段计划：${nextPlan}`,
    "4. 附件依据：建议重点核对1-6月月度汇报、KPI看板、项目材料和历史主管反馈。",
  ].join("\n");
}

function getMidyearRatingByScore(score: number): MidyearRating {
  if (score >= 92) return "A+";
  if (score >= 86) return "A-";
  if (score >= 78) return "B+";
  return "B-";
}

function getMidyearCapabilityByScore(score: number): MidyearCapability {
  if (score >= 92) return "超越胜任";
  if (score >= 84) return "完全胜任";
  if (score >= 75) return "基本胜任";
  return "亟待观察";
}

function getMidyearTrendByScore(score: number): MidyearTrend {
  if (score >= 88) return "箭头向上";
  if (score >= 78) return "箭头持平";
  return "箭头向下";
}

function buildMidyearSupervisorFeedbackDetails(
  data: SubData | null,
  name: string,
  scoreMap: Record<string, number>,
): MidyearSupervisorFeedback {
  const score = computeDirectFeedbackScore(scoreMap);
  const rating = getMidyearRatingByScore(score);
  const capability = getMidyearCapabilityByScore(score);
  const trend = getMidyearTrendByScore(score);
  const kpiScores: MidyearFeedbackScoreRow[] = KPI_SCORE_ITEMS.slice(0, 5).map((item, index) => {
    const supervisorScore = scoreMap[item.id] ?? item.self;
    return {
      id: item.id,
      title: item.title,
      goal: index === 0 ? "底线xx亿，计划xx亿，标杆线xx亿" : "底线x%，计划线x%，标杆线xx%",
      weight: "weight" in item ? item.weight : undefined,
      annualReport: `${item.title}年度目标按既定口径持续推进，需结合YTD达成情况校准。`,
      midyearReport: data?.monthly_report?.highlights ?? `${name}在年中汇报中说明该项已有阶段性成果，但仍需补充关键数据支撑。`,
      monthlyAvg: item.self,
      aiScore: supervisorScore,
      supervisorScore,
      evidence: `员工月度自评平均分为${item.self}分，年中汇报有成果描述，历史反馈提示需加强过程数据和风险前置。`,
    };
  });
  const keyWorkScores: MidyearFeedbackScoreRow[] = KEY_WORK_SCORE_ITEMS.slice(0, 6).map((item) => {
    const supervisorScore = scoreMap[item.id] ?? item.self;
    return {
      id: item.id,
      title: item.title,
      goal: `${item.title}按年度重点工作计划推进，要求形成阶段结果和可追踪里程碑。`,
      time: "2026-12-31",
      annualReport: `${item.title}年度计划整体推进，需关注结果达成和组织协同质量。`,
      midyearReport: data?.monthly_report?.next_plan ?? `${name}年中汇报提到该项需要下阶段持续推进。`,
      monthlyAvg: item.self,
      aiScore: supervisorScore,
      supervisorScore,
      evidence: `结合关键工作进展、月度自评平均分${item.self}分和历史反馈，建议主管评分${supervisorScore}分。`,
    };
  });
  const dimensions = MIDYEAR_ABILITY_DIMENSIONS.map((dimension, index) => {
    const value = Math.max(72, Math.min(96, score + (index % 3 === 0 ? 3 : index % 3 === 1 ? -2 : 0)));
    const dimensionRating = getMidyearRatingByScore(value);
    return {
      ...dimension,
      score: dimensionRating,
      value,
      evidence: `${dimension.label}建议为${dimensionRating}，依据来自上半年核心KPI、关键工作推进和历史反馈中的${dimension.description}表现。`,
    };
  });

  return {
    kpiScores,
    keyWorkScores,
    contributionReview: `该员工上半年主要贡献体现在经营指标跟踪、重点事项协同和流程优化三个方面。能够围绕核心KPI持续推进，重点工作有阶段结果，对组织目标形成较稳定支撑。`,
    regretReview: `员工对不足已有一定反思，主要集中在资源协调、目标拆解和过程复盘。主管视角看，后续需要进一步加强风险前置、跨部门闭环和关键数据沉淀。`,
    overall: {
      score,
      highlights: data?.monthly_report?.highlights ?? `${name}上半年围绕核心KPI和关键工作推进较稳定，目标意识较强。`,
      shortcomings: data?.monthly_report?.shortcomings ?? "过程数据沉淀、风险提前识别和跨部门协同闭环仍有提升空间。",
      nextYearFocus: data?.monthly_report?.next_plan ?? "明年建议继续聚焦核心经营指标达成、重点项目过程管理和跨部门协同效率提升。",
    },
    model: {
      rating,
      dimensions,
      tags: ["结果导向", "组织策划", "资源规划", "团队领导"],
    },
    capability,
    trend,
    evidence: [
      `核心KPI：月度自评均分整体在${Math.round(kpiScores.reduce((sum, item) => sum + item.monthlyAvg, 0) / kpiScores.length)}分左右，年中汇报描述了阶段成果。`,
      `关键工作：重点事项整体按计划推进，但部分事项仍缺少数据支撑和里程碑闭环。`,
      "历史反馈：1-6月主管反馈中多次提到执行稳定、协同较好，同时提示风险前置意识仍需加强。",
      `能力模型：基于结果导向、组织策划和团队协同表现，推荐综合能力为“${capability}”，发展趋势为“${trend}”。`,
    ],
  };
}

function getMidyearFeedbackDetails(draft: FeedbackDraft, scoreMap: Record<string, number>, subName = "该员工") {
  return draft.midyearFeedback ?? buildMidyearSupervisorFeedbackDetails(null, subName, scoreMap);
}

function buildMidyearManagerFeedbackDraft(
  data: SubData | null,
  name: string,
  score: number,
  refined = false,
): FeedbackDraft {
  const scoreMap = getDefaultFeedbackScores();
  SCORE_ITEMS.forEach((item) => {
    scoreMap[item.id] = Math.min(100, Math.max(0, item.self + Math.round((score - 82) / 4)));
  });
  const midyearFeedback = buildMidyearSupervisorFeedbackDetails(data, name, scoreMap);
  const monthlyBase = buildManagerFeedbackDraft(data, name, score, refined);
  const highlights = midyearFeedback.overall.highlights;
  const shortcomings = midyearFeedback.overall.shortcomings;
  const nextFocus = midyearFeedback.overall.nextYearFocus;
  const approvalOpinion = "同意进入年中绩效反馈流程。建议在录入系统前补充关键数据口径和附件材料，确保评价依据完整。";
  return {
    ...monthlyBase,
    score: midyearFeedback.overall.score,
    highlights,
    shortcomings,
    nextFocus,
    approvalOpinion,
    midyearFeedback,
    feedbackText: `整体评价：${name}上半年整体表现稳健，核心KPI和关键工作有阶段性成果，建议综合评分为 ${midyearFeedback.overall.score} 分，推荐等级 ${midyearFeedback.model.rating}。\n\n亮点肯定：${highlights}\n\n不足提醒：${shortcomings}\n\n明年重点工作：${nextFocus}\n\n综合能力：${midyearFeedback.capability}；发展趋势：${midyearFeedback.trend}。\n\n审批意见：${approvalOpinion}`,
  };
}

function normalizeScore(value: string | number) {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.max(0, Math.min(100, Math.round(n)));
}

type FeedbackDraft = {
  score: number;
  highlights: string;
  shortcomings: string;
  nextFocus: string;
  approvalOpinion?: string;
  midyearFeedback?: MidyearSupervisorFeedback;
  feedbackText: string;
  scoreNotes?: Record<string, string>;
  optimized?: Partial<Record<FeedbackHighlightKey, boolean>>;
  optimizedItemIds?: string[];
};

type FeedbackDraftVersion = {
  id: string;
  instruction: string;
  draft: FeedbackDraft;
  scores: Record<string, number>;
};

type FeedbackEmailDraft = {
  to: string;
  cc: string;
  subject: string;
  body: string;
};

function getFeedbackText(draft: FeedbackDraft) {
  const noteRows = SCORE_ITEMS
    .filter((item) => draft.optimizedItemIds?.includes(item.id) || draft.scoreNotes?.[item.id])
    .map((item) => `${item.tag}｜${item.title}：${draft.scoreNotes?.[item.id] ?? "已根据对话要求优化评分依据和推进动作。"}`)
    .join("\n");
  return `综合评价\n综合评分：${draft.score}分\n\n亮点肯定：${draft.highlights}\n\n不足提醒：${draft.shortcomings}\n\n${draft.approvalOpinion ? "下阶段建议" : "下月重点"}：${draft.nextFocus}${draft.approvalOpinion ? `\n\n审批意见：${draft.approvalOpinion}` : ""}${noteRows ? `\n\n核心KPI及关键工作优化：\n${noteRows}` : ""}`;
}

function getFeedbackRecordFields(draft: FeedbackDraft) {
  return {
    highlights: draft.highlights,
    shortcomings: draft.shortcomings,
    nextFocus: draft.nextFocus,
  };
}

function getFeedbackRecipientName(sub: Subordinate) {
  return sub.name === "丁珂珂" ? "丁珂" : sub.name;
}

function buildFeedbackDeliveryBody(sub: Subordinate, draft: FeedbackDraft, scoreMap: Record<string, number>) {
  const kpiRows = KPI_SCORE_ITEMS.map((item, index) =>
    `${index + 1}        ${item.title}        ${item.weight}        ${item.self}分        ${scoreMap[item.id] ?? item.self}分${draft.scoreNotes?.[item.id] ? `\n          评分说明：${draft.scoreNotes[item.id]}` : ""}`,
  ).join("\n");
  const keyWorkRows = KEY_WORK_SCORE_ITEMS.map((item, index) =>
    `${index + 1}        ${item.title}        ${item.self}分        ${scoreMap[item.id] ?? item.self}分${draft.scoreNotes?.[item.id] ? `\n          评分说明：${draft.scoreNotes[item.id]}` : ""}`,
  ).join("\n");
  const feedbackRecipient = getFeedbackRecipientName(sub);

  if (draft.approvalOpinion) {
    return `${feedbackRecipient}总：

以下为你的年中绩效反馈，请推进落实相关工作。

1、整体评价：
${draft.feedbackText.split("\n\n")[0]?.replace(/^整体评价：/, "") || `上半年整体表现稳健，建议综合评分为${draft.score}分。`}

2、亮点肯定：
${draft.highlights}

3、不足提醒：
${draft.shortcomings}

4、下阶段建议：
${draft.nextFocus}

5、审批意见：
${draft.approvalOpinion}

核心kpi和关键工作打分如下:
综合评分：${draft.score}分

1、核心KPI
序号        核心KPI        权重        自评分        主管评分
${kpiRows}
核心KPI主管总评分：${computeWeightedScore(KPI_SCORE_ITEMS, scoreMap)}分

2、关键工作
序号        关键工作        自评分        主管评分
${keyWorkRows}
关键工作主管总评分：${computeAverageScore(KEY_WORK_SCORE_ITEMS, scoreMap)}分`;
  }

  return `${feedbackRecipient}总：

以下为你的4月绩效反馈，请推进落实相关工作。

1、本月亮点：
${draft.highlights}

2、目前需要改善：
${draft.shortcomings}

3、5月需关注的重点工作：
${draft.nextFocus}

核心kpi和关键工作打分如下:
综合评分：${draft.score}分

1、核心KPI
序号        核心KPI        权重        自评分        主管评分
${kpiRows}
核心KPI主管总评分：${computeWeightedScore(KPI_SCORE_ITEMS, scoreMap)}分

2、关键工作
序号        关键工作        自评分        主管评分
${keyWorkRows}
关键工作主管总评分：${computeAverageScore(KEY_WORK_SCORE_ITEMS, scoreMap)}分`;
}

function buildFeedbackEmailDraft(sub: Subordinate, draft: FeedbackDraft, scoreMap: Record<string, number>, cycle: ReportGuideCycle = "monthly"): FeedbackEmailDraft {
  const feedbackRecipient = getFeedbackRecipientName(sub);

  return {
    to: feedbackRecipient,
    cc: "马明哲; 郭晓涛; 集团办机要组; 边亚宁",
    subject: cycle === "midyear" ? `【产险_${feedbackRecipient}】年中绩效反馈（2026年中）` : `【产险_${feedbackRecipient}】月度绩效反馈（26年4月）`,
    body: buildFeedbackDeliveryBody(sub, draft, scoreMap),
  };
}

function computeWeightedScore(items: typeof KPI_SCORE_ITEMS, scoreMap: Record<string, number>) {
  const total = items.reduce((sum, item) => sum + (scoreMap[item.id] ?? item.self) * item.w, 0);
  const weight = items.reduce((sum, item) => sum + item.w, 0);
  return weight ? Math.round(total / weight) : 0;
}

function computeDirectFeedbackScore(scoreMap: Record<string, number>) {
  return computeWeightedScore(KPI_SCORE_ITEMS, scoreMap);
}

function computeAverageScore(items: typeof KEY_WORK_SCORE_ITEMS, scoreMap: Record<string, number>) {
  if (items.length === 0) return 0;
  const total = items.reduce((sum, item) => sum + (scoreMap[item.id] ?? item.self), 0);
  return Math.round((total / items.length) * 10) / 10;
}

function buildPlanAssistantResponse(planId: PlanPhase["id"]) {
  const phase = PLAN_PHASES.find((item) => item.id === planId);
  if (!phase) return "没有找到对应计划模块。";
  const metricLines = phase.metrics.slice(0, 4).map((metric) => {
    const code = metric.code ? `${metric.code} ` : "";
    const value = metric.value ? `：${metric.value}` : "";
    const target = metric.target ? `，目标：${metric.target}` : "";
    return `- ${code}${metric.name}${value}${target}`;
  });
  const sectionLines = phase.sections.slice(0, 2).map((section) => {
    const deadline = section.deadline ? `（${section.deadline}）` : "";
    return `- ${section.title}${deadline}：${section.items.slice(0, 2).join("；")}`;
  });

  return `${phase.id} ${phase.title}
${phase.headline}

核心摘要：${phase.summary}

关键指标/工程：
${metricLines.join("\n")}

管理关注：
${sectionLines.join("\n")}`;
}

function buildTrackingAssistantResponse(suggestionId: SuggestionId, subs: Subordinate[]) {
  if (suggestionId === "missing_reports") {
    const missing = subs.filter((sub) => sub.status === "not_submitted" || sub.status === "reminded");
    const waiting = subs.filter((sub) => sub.status === "pending_feedback");
    const missingNames = missing.slice(0, 6).map((sub) => sub.name).join("、");
    const waitingNames = waiting.map((sub) => sub.name).join("、") || "暂无";
    return `本月仍有 ${missing.length} 名下属未提交汇报，优先关注：${missingNames}${missing.length > 6 ? "等" : ""}。\n\n待主考反馈：${waitingNames}。建议先催办未提交人员，再处理已提交但待反馈的绩效确认。`;
  }

  if (suggestionId === "team_kpi") {
    const confirmed = subs.filter((sub) => sub.status === "confirmed");
    const pending = subs.filter((sub) => sub.status === "pending_feedback");
    return `团队 KPI 当前以月度追踪和主考反馈为主线：已确认 ${confirmed.length} 人，待反馈 ${pending.length} 人。\n\n建议先查看丁珂珂等已提交对象的核心 KPI、关键工作和上月主管反馈，再补齐未提交人员的催办闭环。`;
  }

  return "已定位到丁珂珂的历史评价趋势。她本月处于待反馈状态，适合对照近三个月主管评价、KPI 自评和关键工作进展后生成反馈。";
}

function AIAssistant({
  mode, setMode, selectedSub, subs, activeModule, scores, setScores, panelMode, onSelectSub, onToggleFloating, onToggleFullscreen, onClosePanel, onFeedbackSubmitted, onPersonalConfirmed, onStartFloatingDrag, onStartPersonalReport, onStartFeedback, onExitWorkContext,
}: {
  mode: AIMode;
  setMode: (m: AIMode) => void;
  selectedSub: Subordinate | null;
  subs: Subordinate[];
  activeModule: ManagerModuleKey;
  scores: Record<string, number>;
  setScores: (s: Record<string, number>) => void;
  panelMode: AIPanelMode;
  onSelectSub: (sub: Subordinate) => void;
  onToggleFloating: () => void;
  onToggleFullscreen: () => void;
  onClosePanel: () => void;
  onFeedbackSubmitted: (subId: string, feedback: SubmittedFeedback) => void;
  onPersonalConfirmed: (report?: SubmittedPersonalMonthlyReport) => void;
  onStartFloatingDrag: (event: React.PointerEvent<HTMLDivElement>) => void;
  onStartPersonalReport: () => void;
  onStartFeedback: (sub: Subordinate) => void;
  onExitWorkContext: () => void;
}) {
  const fetchSub = useServerFn(getSubordinateData);
  const saveRec = useServerFn(saveFeedbackRecord);
  const listRec = useServerFn(listFeedbackRecords);

  const [editText, setEditText] = useState("");
  const [subData, setSubData] = useState<SubData | null>(null);
  const [loadingData, setLoadingData] = useState(false);
  const [draft, setDraft] = useState<FeedbackDraft | null>(null);
  const [initialDraft, setInitialDraft] = useState<FeedbackDraft | null>(null);
  const [feedbackVersions, setFeedbackVersions] = useState<FeedbackDraftVersion[]>([]);
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sentRecord, setSentRecord] = useState<{ at: string; emailSent: boolean; emailPending?: boolean } | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [insight, setInsight] = useState<AssistantInsight | null>(null);
  const [utilityPanel, setUtilityPanel] = useState<"history" | null>(null);
  const [emailDraft, setEmailDraft] = useState<FeedbackEmailDraft | null>(null);
  const [chatInput, setChatInput] = useState("");
  const [dialogueMessages, setDialogueMessages] = useState<Array<{ id: string; role: "user" | "assistant"; text: string }>>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [monthlyGuideOpen, setMonthlyGuideOpen] = useState(false);
  const [personalInstruction, setPersonalInstruction] = useState<{ id: number; text: string } | null>(null);
  const [rankingSession, setRankingSession] = useState<TeamRankingSession | null>(null);
  const draftRef = useRef<FeedbackDraft | null>(null);
  const scrollViewportRef = useRef<HTMLDivElement>(null);
  const scrollAnchorRef = useRef<HTMLDivElement>(null);
  const activeModuleRef = useRef(activeModule);
  const defaultPrompts =
    activeModule === "assessment"
      ? ASSESSMENT_QUESTION_PROMPTS
      : activeModule === "plan"
        ? PLAN_QUESTION_PROMPTS
        : DEFAULT_QUESTION_PROMPTS;
  const assistantIntro =
    activeModule === "assessment"
      ? "已切换到考核场景，可根据直接下属 KPI 得分生成排名，并继续做调档校验。"
      : activeModule === "plan"
        ? "已切换到计划场景，可基于 K0-K4 梳理目标、过程指标、重点项目和风险边界。"
        : "可以帮你追踪团队汇报、分析 KPI 完成情况，并整理历史评价趋势。";

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);
  // Auto-fetch data + generate full feedback when entering scoring mode.
  useEffect(() => {
    let cancelled = false;
    if (mode === "scoring" && selectedSub) {
      const defaultScores = getDefaultFeedbackScores();
      const fallbackSubData = SAMPLE_SUB_DATA_BY_ID[selectedSub.id] ?? null;
      setScores(defaultScores);
      setLoadingData(true);
      setGenerating(true);
      setDraft(null);
      setSubData(fallbackSubData);
      fetchSub({ data: { subId: selectedSub.id } })
        .then((d) => {
          if (cancelled) return;
          const resolvedData = d ?? fallbackSubData;
          setSubData(resolvedData);
          window.setTimeout(() => {
            if (cancelled) return;
            const generatedDraft = buildManagerFeedbackDraft(resolvedData, resolvedData?.name || selectedSub.name, computeScore(defaultScores));
            setDraft(generatedDraft);
            setInitialDraft(generatedDraft);
            setFeedbackVersions([]);
            setGenerating(false);
            setMode("generated");
          }, 800);
        })
        .catch((e) => {
          if (cancelled) return;
          toast.error("数据获取失败：" + e.message);
          window.setTimeout(() => {
            if (cancelled) return;
            const generatedDraft = buildManagerFeedbackDraft(fallbackSubData, fallbackSubData?.name || selectedSub.name, computeScore(defaultScores));
            setDraft(generatedDraft);
            setInitialDraft(generatedDraft);
            setFeedbackVersions([]);
            setGenerating(false);
            setMode("generated");
          }, 800);
        })
        .finally(() => {
          if (!cancelled) setLoadingData(false);
        });
      listRec({ data: { subId: selectedSub.id } }).then(setHistory).catch(() => {});
    }
    if (mode === "default") {
      setDraft(null); setInitialDraft(null); setFeedbackVersions([]); setSubData(null); setSentRecord(null); setGenerating(false); setLoadingData(false); setEmailDraft(null); setDialogueMessages([]); setPreviewOpen(false); setPersonalInstruction(null); setRankingSession(null);
    }
    return () => { cancelled = true; };
  }, [mode, selectedSub, fetchSub, listRec]);

  const computeScore = (scoreMap = scores) => {
    const filled = KPI_SCORE_ITEMS.filter((i) => scoreMap[i.id] != null);
    if (filled.length === 0) return 80;
    const sum = filled.reduce((a, i) => a + (scoreMap[i.id] || 0) * i.w, 0);
    const wsum = filled.reduce((a, i) => a + i.w, 0);
    return wsum ? Math.round(sum / wsum) : 80;
  };

  const rewriteFeedbackWithInstruction = (instruction: string) => {
    const currentDraft = feedbackVersions.at(-1)?.draft ?? draftRef.current ?? draft;
    if (!currentDraft) return;
    setTimeout(() => {
      const conciseInstruction = instruction.trim();
      const optimizedItemIds = getFeedbackOptimizationTargets(conciseInstruction);
      const scoreNotes = buildFeedbackScoreNotes(conciseInstruction, optimizedItemIds);
      const delta = getInstructionScoreDelta(conciseInstruction);
      const scoreOverride = getInstructionScoreOverride(conciseInstruction);
      const nextScores = { ...scores };
      optimizedItemIds.forEach((id) => {
        const item = SCORE_ITEMS.find((scoreItem) => scoreItem.id === id);
        const current = nextScores[id] ?? item?.self ?? 80;
        nextScores[id] = scoreOverride ?? Math.max(0, Math.min(100, current + delta));
      });
      setScores(nextScores);
      const nextScore = computeScore(nextScores);
      const revisedContent = buildFeedbackRevisionContent(currentDraft, conciseInstruction, optimizedItemIds);
      const nextDraft = {
        ...currentDraft,
        score: nextScore,
        highlights: revisedContent.highlights,
        shortcomings: revisedContent.shortcomings,
        nextFocus: revisedContent.nextFocus,
        scoreNotes: {
          ...currentDraft.scoreNotes,
          ...scoreNotes,
        },
        optimized: { highlights: true, shortcomings: true, nextFocus: true },
        optimizedItemIds,
      };
      nextDraft.feedbackText = getFeedbackText(nextDraft);
      setDraft(nextDraft);
      setFeedbackVersions((versions) => [
        ...versions,
        {
          id: `fv-${Date.now()}`,
          instruction: conciseInstruction,
          draft: nextDraft,
          scores: nextScores,
        },
      ]);
    }, 650);
  };

  const startAssessmentRanking = (promptText = "帮我做下团队考核排名") => {
    const session = buildInitialTeamRanking(subs);
    setMode("assessment_ranking");
    setInsight(null);
    setRankingSession(session);
    setDialogueMessages((messages) => [
      ...messages,
      { id: `u-${Date.now()}`, role: "user", text: promptText },
      { id: `a-${Date.now() + 1}`, role: "assistant", text: session.assistantNote },
    ]);
  };

  const runAssessmentInstruction = (instruction: string) => {
    const current = rankingSession ?? buildInitialTeamRanking(subs);
    const next = applyRankingInstruction(current, instruction);
    setMode("assessment_ranking");
    setRankingSession(next);
    setDialogueMessages((messages) => [
      ...messages,
      { id: `u-${Date.now()}`, role: "user", text: instruction },
      { id: `a-${Date.now() + 1}`, role: "assistant", text: next.warning ? `${next.assistantNote}\n${next.warning}` : next.assistantNote },
    ]);
  };

  const sendChatInstruction = () => {
    const instruction = chatInput.trim();
    if (!instruction) return;
    setChatInput("");

    if (isMonthlyReportGuideRequest(instruction)) {
      setDialogueMessages((messages) => [
        ...messages,
        { id: `u-${Date.now()}`, role: "user", text: instruction },
        { id: `a-${Date.now() + 1}`, role: "assistant", text: MONTHLY_REPORT_GUIDE_RESPONSE },
      ]);
      return;
    }

    if ((activeModule === "assessment" || mode === "assessment_ranking") && /团队考核排名|考核排名|排名调整|调档|上调|下调|调成|调至|调到|调为|调整|改成|改为|设为|升|降|重置|恢复|还原|确认|提交/.test(instruction)) {
      if (/团队考核排名|考核排名/.test(instruction)) {
        startAssessmentRanking(instruction);
      } else {
        runAssessmentInstruction(instruction);
      }
      return;
    }

    if (isPersonalReportRequest(instruction)) {
      setDialogueMessages((messages) => [
        ...messages,
        { id: `u-${Date.now()}`, role: "user", text: instruction },
      ]);
      onStartPersonalReport();
      return;
    }

    const feedbackTarget = parseFeedbackRequest(instruction, subs);
    if (feedbackTarget) {
      setDialogueMessages((messages) => [
        ...messages,
        { id: `u-${Date.now()}`, role: "user", text: instruction },
        { id: `a-${Date.now() + 1}`, role: "assistant", text: `好的，正在打开${feedbackTarget.name}的绩效详情，并生成反馈初稿。` },
      ]);
      onStartFeedback(feedbackTarget);
      return;
    }

    setDialogueMessages((messages) => [
      ...messages,
      { id: `u-${Date.now()}`, role: "user", text: instruction },
    ]);

    if (mode === "generated" && (draftRef.current ?? draft)) {
      rewriteFeedbackWithInstruction(instruction);
      return;
    }

    if (mode === "personal_generated") {
      setPersonalInstruction({ id: Date.now(), text: instruction });
      return;
    }

    setDialogueMessages((messages) => [
      ...messages,
      { id: `a-${Date.now()}`, role: "assistant", text: "当前对话还没有可改写的汇报或反馈草稿，请先生成内容。" },
    ]);
  };

  const persistRecord = async (emailSent: boolean, emailPending = false) => {
    if (!selectedSub || !draft) return false;
    const feedbackFields = getFeedbackRecordFields(draft);
    setSending(true);
    try {
      const r = await saveRec({
        data: {
          subId: selectedSub.id,
          subName: selectedSub.name,
          score: draft.score,
          highlights: feedbackFields.highlights,
          shortcomings: feedbackFields.shortcomings,
          nextFocus: feedbackFields.nextFocus,
          scoresDetail: scores,
          emailSent,
        },
      });
      setSentRecord({ at: r.sent_at || r.created_at, emailSent, emailPending });
      const fresh = await listRec({ data: { subId: selectedSub.id } });
      setHistory(fresh);
      setMode("sent");
      toast.success(emailSent ? "反馈已录入系统并转发邮件" : "反馈已录入系统");
      return true;
    } catch (e: any) {
      toast.error("保存失败：" + e.message);
      return false;
    } finally {
      setSending(false);
    }
  };

  const openEmailDraftDialog = () => {
    if (!selectedSub || !draft) return;
    setEmailDraft(buildFeedbackEmailDraft(selectedSub, draft, scores));
  };

  const recordAndOpenEmailDraftDialog = async () => {
    if (!selectedSub || !draft) return;
    const ok = await persistRecord(false, true);
    if (ok) openEmailDraftDialog();
  };

  const confirmEmailSend = async () => {
    if (!emailDraft) return;
    setEmailDraft(null);
    setSentRecord((prev) => ({
      at: prev?.at || new Date().toISOString(),
      emailSent: true,
      emailPending: false,
    }));
    toast.success("反馈邮件已转发给下属，并抄送上级");
  };

  const submitFeedbackToPanel = () => {
    if (!selectedSub || !draft) return;
    const feedbackFields = getFeedbackRecordFields(draft);
    onFeedbackSubmitted(selectedSub.id, {
      score: draft.score,
      highlights: feedbackFields.highlights,
      shortcomings: feedbackFields.shortcomings,
      nextFocus: feedbackFields.nextFocus,
      period: getCurrentMonthPeriod(),
      submittedAt: new Date().toISOString(),
    });
    toast.success("反馈已同步至左侧上级反馈");
  };

  const recordFeedbackOnly = async () => {
    submitFeedbackToPanel();
    const ok = await persistRecord(false);
    if (ok) setPreviewOpen(false);
  };

  const recordFeedbackAndOpenEmail = async () => {
    submitFeedbackToPanel();
    const ok = await persistRecord(false, true);
    if (ok) {
      setPreviewOpen(false);
      openEmailDraftDialog();
    }
  };

  const runSuggestion = (suggestion: (typeof SUGGESTIONS)[number]) => {
    setInsight({ id: suggestion.id, question: suggestion.text });
    if (suggestion.id === "zhou_trend") {
      const zhou = subs.find((s) => s.name === "丁珂珂");
      if (zhou) onSelectSub(zhou);
    }
    setDialogueMessages((messages) => [
      ...messages,
      { id: `u-${Date.now()}`, role: "user", text: suggestion.text },
      { id: `a-${Date.now() + 1}`, role: "assistant", text: buildTrackingAssistantResponse(suggestion.id, subs) },
    ]);
  };

  const startDefaultPrompt = (prompt: DefaultQuestionPrompt) => {
    if ("guideAction" in prompt) {
      setMonthlyGuideOpen(true);
      setDialogueMessages((messages) => [
        ...messages,
        { id: `u-${Date.now()}`, role: "user", text: prompt.text },
        { id: `a-${Date.now() + 1}`, role: "assistant", text: "已打开月度汇报填报反馈指南。你也可以直接问我“月度汇报怎么填”，我会在对话里输出完整要点。" },
      ]);
      return;
    }

    if ("planId" in prompt) {
      setInsight(null);
      setDialogueMessages((messages) => [
        ...messages,
        { id: `u-${Date.now()}`, role: "user", text: prompt.text },
        { id: `a-${Date.now() + 1}`, role: "assistant", text: buildPlanAssistantResponse(prompt.planId) },
      ]);
      return;
    }

    if ("assessmentAction" in prompt) {
      if (prompt.assessmentAction === "ranking") {
        startAssessmentRanking(prompt.text);
      } else {
        runAssessmentInstruction(prompt.text);
      }
      return;
    }

    if ("suggestionId" in prompt) {
      const suggestion = SUGGESTIONS.find((item) => item.id === prompt.suggestionId);
      if (suggestion) runSuggestion(suggestion);
      return;
    }

    if (prompt.mode === "personal_scoring") {
      onStartPersonalReport();
      return;
    }

    const pendingSub = selectedSub ?? subs.find((sub) => sub.status === "pending_feedback") ?? null;
    if (pendingSub) {
      onSelectSub(pendingSub);
      setMode(prompt.mode);
    }
  };

  const resetAssistantState = (notify = false) => {
    setMode("default");
    onExitWorkContext();
    setScores({});
    setEditText("");
    setSubData(null);
    setDraft(null);
    setLoadingData(false);
    setGenerating(false);
    setSending(false);
    setSentRecord(null);
    setInsight(null);
    setUtilityPanel(null);
    setChatInput("");
    setDialogueMessages([]);
    setRankingSession(null);
    setPreviewOpen(false);
    setMonthlyGuideOpen(false);
    if (notify) toast.success("已新建对话");
  };

  const startNewDialog = () => {
    resetAssistantState(true);
  };

  useEffect(() => {
    if (activeModuleRef.current === activeModule) return;
    activeModuleRef.current = activeModule;
    resetAssistantState(false);
  }, [activeModule]);

  useEffect(() => {
    const viewport = scrollViewportRef.current;
    const anchor = scrollAnchorRef.current;
    if (!viewport || !anchor) return;
    window.requestAnimationFrame(() => {
      anchor.scrollIntoView({ block: "end", behavior: "smooth" });
    });
  }, [
    dialogueMessages.length,
    mode,
    generating,
    loadingData,
    draft?.feedbackText,
    insight?.id,
    rankingSession?.assistantNote,
    rankingSession?.warning,
  ]);

  return (
    <>
      <div
        className={`relative overflow-hidden border-b border-border/50 bg-white px-4 py-3 ${
          panelMode === "floating" ? "cursor-move select-none" : ""
        }`}
        onPointerDown={onStartFloatingDrag}
      >
        <div className="absolute inset-x-0 bottom-0 h-24 bg-[radial-gradient(circle_at_50%_100%,rgba(134,144,156,0.13),transparent_68%)]" />
        <div className="relative flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-base font-bold tracking-tight">绩效 AI 助理</p>
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <button
              type="button"
              onClick={startNewDialog}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-primary-soft hover:text-primary"
              title="新建对话"
              aria-label="新建对话"
            >
              <Plus className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setUtilityPanel((panel) => panel === "history" ? null : "history")}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-primary-soft hover:text-primary ${
                utilityPanel === "history" ? "bg-primary-soft text-primary" : ""
              }`}
              title="历史对话"
              aria-label="历史对话"
            >
              <Clock3 className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onToggleFloating}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-primary-soft hover:text-primary ${
                panelMode === "floating" ? "bg-primary-soft text-primary" : ""
              }`}
              title="窗口浮动"
              aria-label="窗口浮动"
            >
              <PanelRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onToggleFullscreen}
              className={`flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-primary-soft hover:text-primary ${
                panelMode === "fullscreen" ? "bg-primary-soft text-primary" : ""
              }`}
              title="窗口全屏"
              aria-label="窗口全屏"
            >
              <ScanLine className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onClosePanel}
              className="flex h-8 w-8 items-center justify-center rounded-lg transition hover:bg-primary-soft hover:text-primary"
              title="关闭窗口"
              aria-label="关闭窗口"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <div ref={scrollViewportRef} className="relative flex-1 overflow-y-auto bg-white px-4 py-4">
        <div className="relative space-y-4">
        {utilityPanel && (
          <AssistantUtilityPanel
            history={history}
            insight={insight}
            sentRecord={sentRecord}
            onClose={() => setUtilityPanel(null)}
          />
        )}
        {mode === "default" && (
          <div className="w-full pb-8">
            <p className="pt-3 text-center text-xs font-medium text-slate-500">已加载全部历史记录</p>

            <section className="mt-5 rounded-[22px] border border-slate-100 bg-gradient-to-br from-sky-50 via-white to-white p-5 shadow-[0_18px_60px_rgba(37,99,235,0.08)]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="text-xl font-bold leading-tight tracking-tight text-slate-950">Hi，我是你的绩效 AI 助手</h2>
                  <p className="mt-2 max-w-[560px] text-sm font-medium leading-6 text-slate-500">
                    {assistantIntro}
                  </p>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-cyan-300/70 shadow-[0_0_30px_rgba(34,211,238,0.5)]">
                  <Sparkles className="h-6 w-6 text-white" strokeWidth={2.8} />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setMonthlyGuideOpen(true)}
                className="mt-6 flex w-full items-center gap-4 rounded-2xl border border-primary/15 bg-white px-5 py-4 text-left shadow-sm transition hover:border-primary/25 hover:bg-primary-soft/45"
              >
                <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-primary-soft text-primary">
                  <BookOpenText className="h-6 w-6" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-black text-slate-950">月度汇报填报反馈指南</span>
                  <span className="mt-1 block truncate text-sm font-semibold text-slate-500">新人填报、评分和上级反馈要点</span>
                </span>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />
              </button>

              <p className="mt-6 text-sm font-bold tracking-tight text-slate-700">推荐提问</p>
              <div className="mt-3 overflow-hidden rounded-2xl bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)] ring-1 ring-slate-100">
                {defaultPrompts.slice(0, RECOMMENDED_PROMPT_LIMIT).map((prompt) => (
                  <button
                    key={prompt.text}
                    type="button"
                    onClick={() => startDefaultPrompt(prompt)}
                    className="group flex min-h-[56px] w-full items-center gap-3 border-b border-slate-100 px-5 text-left transition last:border-b-0 hover:bg-slate-50"
                  >
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold leading-tight text-slate-900">
                      {prompt.text}
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-slate-800" />
                  </button>
                ))}
              </div>
            </section>

            {insight && (
              <SuggestionInsightCard
                insight={insight}
                subs={subs}
              />
            )}
          </div>
        )}

        {(mode === "personal_scoring" || mode === "personal_generated" || mode === "personal_editing") && (
          <PersonalReportFlow
            mode={mode}
            setMode={setMode}
            dialogueMessages={dialogueMessages}
            externalInstruction={personalInstruction}
            onExternalInstructionHandled={(response) => {
              setPersonalInstruction(null);
              if (response) {
                setDialogueMessages((messages) => [
                  ...messages,
                  { id: `a-${Date.now()}`, role: "assistant", text: response },
                ]);
              }
            }}
            onConfirmed={(submittedReport) => {
              onPersonalConfirmed(submittedReport);
              toast.success("月度汇报已录入系统");
            }}
          />
        )}

        {mode === "assessment_ranking" && rankingSession && (
          <TeamAssessmentRankingFlow
            session={rankingSession}
            messages={dialogueMessages}
          />
        )}

        {mode === "scoring" && selectedSub && (
          <BotBubble>
            <div className="flex items-start gap-2 text-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary mt-0.5" />
              <div>
                <p>
                  正在根据汇报、邮件和协同记录，为 <b>{selectedSub.name}</b> 生成反馈草稿。
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  生成后可直接修订正文，并一键录入系统或转发邮件。
                </p>
                {loadingData && (
                  <p className="text-xs text-muted-foreground mt-2">正在读取当月汇报、年度计划和协同记录...</p>
                )}
              </div>
            </div>
          </BotBubble>
        )}

        {mode === "generated" && selectedSub && (
          <GeneratedFeedback
            sub={selectedSub}
            draft={draft}
            initialDraft={initialDraft}
            versions={feedbackVersions}
            generating={generating}
            sending={sending}
            scores={scores}
            onEdit={(text) => { setEditText(text); setMode("editing"); }}
            dialogueMessages={dialogueMessages}
            onConfirm={() => setPreviewOpen(true)}
          />
        )}

        {mode === "editing" && selectedSub && (
          <BotBubble>
            <p className="text-xs leading-relaxed">已打开修订弹窗，可直接修改反馈正文和综合评分。</p>
          </BotBubble>
        )}

        {mode === "sent" && selectedSub && sentRecord && (
          <BotBubble>
            <div className="flex items-start gap-2 text-xs">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <div>
                <p className="font-semibold text-success">
                {sentRecord.emailSent ? "已录入系统，并已转发邮件" : sentRecord.emailPending ? "已录入系统，待确认转发邮件" : "已录入系统"}
                </p>
                <div className="mt-1 space-y-0.5 leading-relaxed text-muted-foreground">
                  <p>下属：{selectedSub.name}</p>
                  <p>时间：{new Date(sentRecord.at).toLocaleString("zh-CN")}</p>
                  <p>
                    状态：
                    {sentRecord.emailSent
                      ? "系统已更新，邮件已发送"
                      : sentRecord.emailPending
                        ? "系统已更新，待确认邮件"
                        : "系统已更新，未发送邮件"}
                  </p>
                  <p>左侧下属绩效卡片状态已同步更新为已确认。</p>
                </div>
              </div>
            </div>
          </BotBubble>
        )}

        {mode !== "personal_scoring" && mode !== "personal_generated" && mode !== "personal_editing" && mode !== "assessment_ranking" && mode !== "generated" && (
          <AssistantDialogueMessages messages={dialogueMessages} />
        )}

        <div ref={scrollAnchorRef} aria-hidden="true" />
        </div>
      </div>

      {previewOpen && selectedSub && draft && (
        <GeneratedContentPreviewDialog
          title={`确认${selectedSub.name}月度绩效反馈`}
          subtitle="请确认反馈正文和主考评分，确认后再录入系统。"
          content={buildFeedbackDeliveryBody(selectedSub, draft, scores)}
          score={draft.score}
          sending={sending}
          onBack={() => setPreviewOpen(false)}
          onSubmitSystem={recordFeedbackOnly}
          onSubmitEmail={recordFeedbackAndOpenEmail}
        />
      )}

      {/* Editing slide-up card — 主管反馈与评分 */}
      {mode === "editing" && draft && (
        <EditFeedbackCard
          draft={draft}
          scores={scores}
          onClose={() => setMode("generated")}
          onSave={(d, nextScores) => {
            setDraft(d);
            setScores(nextScores);
            setMode("generated");
            toast.success("已保存修改");
          }}
        />
      )}

      {emailDraft && selectedSub && (
        <FeedbackEmailDialog
          draft={emailDraft}
          subName={selectedSub.name}
          sending={sending}
          onChange={setEmailDraft}
          onClose={() => setEmailDraft(null)}
          onConfirm={confirmEmailSend}
        />
      )}

      {monthlyGuideOpen && (
        <MonthlyReportGuideDialog
          onClose={() => setMonthlyGuideOpen(false)}
        />
      )}

      {/* Input */}
      {mode !== "editing" && mode !== "personal_editing" && (
        <div className="border-t border-border/40 bg-white p-3.5">
          <div className="rounded-2xl border border-primary/45 bg-white p-2.5 shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
            <textarea
              rows={2}
              value={chatInput}
              onChange={(event) => setChatInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  sendChatInstruction();
                }
              }}
              placeholder="请将您遇到的问题告诉我，使用 Shift + Enter 换行"
              className="min-h-[54px] w-full resize-none bg-transparent text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none"
            />
            <div className="mt-2 flex items-center justify-end">
              <button
                type="button"
                onClick={sendChatInstruction}
                disabled={!chatInput.trim() || generating}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
          <p className="mt-3 text-center text-[11px] text-muted-foreground">
            内容由 AI 生成，仅供参考
          </p>
        </div>
      )}
    </>
  );
}

function GeneratedContentPreviewDialog({
  title,
  subtitle,
  content,
  score,
  sending,
  onBack,
  onSubmitSystem,
  onSubmitEmail,
}: {
  title: string;
  subtitle: string;
  content: string;
  score?: number;
  sending: boolean;
  onBack: () => void;
  onSubmitSystem: () => void | Promise<void>;
  onSubmitEmail: () => void | Promise<void>;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-slate-950/25 px-4 pt-16">
      <section className="flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-[0_28px_90px_rgba(15,23,42,0.24)]">
        <div className="flex items-start justify-between gap-4 border-b border-border bg-primary-soft/45 px-6 py-5">
          <div className="min-w-0">
            <p className="text-lg font-black tracking-tight text-foreground">{title}</p>
            <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
          </div>
          {score != null && (
            <span className="shrink-0 rounded-full bg-white px-3 py-1 text-sm font-black text-primary shadow-sm ring-1 ring-primary/10">
              {score} 分
            </span>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white p-6">
          <div className="rounded-2xl border border-border bg-secondary/25 p-5">
            <p className="whitespace-pre-wrap text-sm leading-7 text-foreground">{content}</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 border-t border-border bg-secondary/20 px-6 py-4">
          <button
            type="button"
            onClick={onBack}
            disabled={sending}
            className="rounded-xl border border-primary/30 bg-white px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            返回至对话
          </button>
          <button
            type="button"
            onClick={onSubmitSystem}
            disabled={sending}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            录入系统
          </button>
          <button
            type="button"
            onClick={onSubmitEmail}
            disabled={sending}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-primary/30 bg-white px-4 py-2.5 text-sm font-semibold text-primary transition hover:bg-primary-soft disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Mail className="h-4 w-4" />
            录入系统并同步发邮件
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function FeedbackEmailDialog({
  draft,
  subName,
  sending,
  onChange,
  onClose,
  onConfirm,
}: {
  draft: FeedbackEmailDraft;
  subName: string;
  sending: boolean;
  onChange: (draft: FeedbackEmailDraft) => void;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const update = (patch: Partial<FeedbackEmailDraft>) => onChange({ ...draft, ...patch });

  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[9999] flex items-start justify-center px-4 pt-24">
      <section className="pointer-events-auto flex max-h-[84vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-[0_28px_90px_rgba(15,23,42,0.2)]">
        <div className="flex items-start justify-between gap-4 border-b border-border bg-[linear-gradient(110deg,#ffffff_0%,var(--primary-soft)_65%,var(--secondary)_100%)] px-6 py-5">
          <div>
            <p className="text-lg font-bold tracking-tight">同步发送邮件</p>
            <p className="mt-1 text-sm text-muted-foreground">发送前可编辑收件人、抄送人、主题与正文。</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-white/70 hover:text-foreground disabled:opacity-50"
            aria-label="关闭邮件编辑弹窗"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto bg-white px-6 py-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <EmailField
              label="收件人"
              value={draft.to}
              placeholder={`${subName} 或邮箱地址`}
              onChange={(value) => update({ to: value })}
            />
            <EmailField
              label="抄送人"
              value={draft.cc}
              placeholder="可填写多人，用逗号分隔"
              onChange={(value) => update({ cc: value })}
            />
          </div>

          <div className="mt-4">
            <EmailField
              label="邮件主题"
              value={draft.subject}
              onChange={(value) => update({ subject: value })}
            />
          </div>

          <label className="mt-4 block rounded-2xl border border-primary/18 bg-primary-soft/18 p-3">
            <span className="text-xs font-semibold text-muted-foreground">邮件正文</span>
            <textarea
              value={draft.body}
              onChange={(e) => update({ body: e.target.value })}
              rows={18}
              className="mt-2 w-full resize-y rounded-xl border border-border bg-white px-4 py-3 text-sm leading-relaxed text-foreground shadow-inner focus:border-primary/35 focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </label>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-border bg-secondary/20 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="rounded-xl border border-border bg-white px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-secondary disabled:opacity-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={sending || !draft.to.trim() || !draft.subject.trim() || !draft.body.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground shadow-sm transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
            确认发送
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

function AIBotHeroIcon() {
  return (
    <svg
      className="absolute left-0 top-[-18px] h-28 w-28 animate-pulse [animation-duration:3s]"
      viewBox="0 0 120 120"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="ai-bot-shell" x1="24" y1="12" x2="94" y2="110" gradientUnits="userSpaceOnUse">
          <stop stopColor="#f8fafc" />
          <stop offset="0.52" stopColor="#c7ccd6" />
          <stop offset="1" stopColor="#42464e" />
        </linearGradient>
        <linearGradient id="ai-bot-face" x1="33" y1="31" x2="88" y2="76" gradientUnits="userSpaceOnUse">
          <stop stopColor="#2f3a4f" />
          <stop offset="1" stopColor="#121826" />
        </linearGradient>
        <linearGradient id="ai-bot-card" x1="16" y1="56" x2="93" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#737a87" stopOpacity="0.95" />
          <stop offset="1" stopColor="#1d4ed8" stopOpacity="0.72" />
        </linearGradient>
        <filter id="ai-bot-shadow" x="3" y="4" width="111" height="112" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feDropShadow dx="0" dy="10" stdDeviation="9" floodColor="#1d4ed8" floodOpacity="0.2" />
        </filter>
      </defs>

      <g filter="url(#ai-bot-shadow)">
        <path d="M25 48c0-20.4 16.6-37 37-37s37 16.6 37 37v30c0 19.9-16.1 36-36 36h-2c-19.9 0-36-16.1-36-36V48Z" fill="url(#ai-bot-shell)" />
        <path d="M18 47c0-8.3 6.7-15 15-15h2v35h-2c-8.3 0-15-6.7-15-15v-5Z" fill="#9aa3af" />
        <path d="M89 32h2c8.3 0 15 6.7 15 15v5c0 8.3-6.7 15-15 15h-2V32Z" fill="#737a87" />
        <path d="M34 46c0-9.4 7.6-17 17-17h23c9.4 0 17 7.6 17 17v12c0 9.4-7.6 17-17 17H51c-9.4 0-17-7.6-17-17V46Z" fill="url(#ai-bot-face)" />
        <rect x="50" y="46" width="7" height="19" rx="3.5" fill="white" />
        <rect x="71" y="46" width="7" height="19" rx="3.5" fill="white" />
        <path d="M47 14h30l-5 8H52l-5-8Z" fill="#f1f3f5" opacity="0.72" />
      </g>

      <g opacity="0.94">
        <rect x="9" y="63" width="74" height="39" rx="8" fill="url(#ai-bot-card)" />
        <path d="M17 72h34" stroke="#f8fafc" strokeWidth="3" strokeLinecap="round" strokeDasharray="2 4" opacity="0.7" />
        <path d="M54 80h18M54 89h13" stroke="#f8fafc" strokeWidth="4" strokeLinecap="round" opacity="0.82" />
        <path d="M34.5 78.5 38 83l5.5.5-3.5 4.2 1 5.3-5.2-2-4.8 2.7.4-5.6-4.2-3.7 5.5-1.3 1.8-4.6Z" fill="#f8fafc" opacity="0.9" />
        <circle cx="35" cy="86" r="5.5" fill="#1d4ed8" opacity="0.82" />
      </g>
    </svg>
  );
}

function EmailField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="mt-2 h-11 w-full rounded-xl border border-border bg-white px-3 text-sm text-foreground shadow-sm focus:border-primary/35 focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
    </label>
  );
}

function BotBubble({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl bg-primary-soft/60 p-3.5">{children}</div>;
}

function AssistantDialogueMessages({ messages }: { messages: Array<{ id: string; role: "user" | "assistant"; text: string }> }) {
  if (messages.length === 0) return null;
  return (
    <div className="space-y-2">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-xs font-medium leading-relaxed shadow-sm ${
            message.role === "user"
              ? "ml-auto max-w-[82%] rounded-br-md bg-primary text-primary-foreground"
              : "mr-auto max-w-[88%] rounded-tl-md bg-primary-soft/60 text-foreground"
          }`}
        >
          {message.text}
        </div>
      ))}
    </div>
  );
}

function TeamAssessmentRankingFlow({
  session,
  messages,
}: {
  session: TeamRankingSession;
  messages: Array<{ id: string; role: "user" | "assistant"; text: string }>;
}) {
  return (
    <div className="space-y-3">
      <AssistantDialogueMessages messages={messages} />

      <BotBubble>
        <div className="space-y-3">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary text-white shadow-sm">
              <Star className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-slate-900">产险一把手考核排名 · 调档台</p>
              <p className="mt-1 text-xs font-semibold leading-relaxed text-slate-500">{session.assistantNote}</p>
            </div>
          </div>

          {session.warning && (
            <div className="flex items-start gap-2 rounded-xl border border-[#ff6b35]/25 bg-[#fff2ed] px-3 py-2 text-xs font-bold text-[#c2410c]">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{session.warning}</span>
            </div>
          )}

          <div className="grid grid-cols-4 gap-2">
            <MiniMetric label="已调档" value={session.adjustedCount} tone="primary" />
            <MiniMetric label="上调" value={session.upCount} tone="success" />
            <MiniMetric label="下调" value={session.downCount} tone="warning" />
            <MiniMetric label="人数" value={session.rows.length} tone="muted" />
          </div>

          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
            <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-2 text-xs font-bold text-slate-500">
              <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-success-soft" />上调</span>
              <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-[#fff2ed] ring-1 ring-[#ff6b35]/20" />下调</span>
              <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-white ring-1 ring-success/20" />调档≤2档</span>
              <span className="inline-flex items-center gap-1"><span className="h-3 w-3 rounded bg-[#fff2ed] ring-2 ring-[#ff6b35]" />2档调整预警</span>
            </div>
            <div className="overflow-x-auto [scrollbar-color:#cbd5e1_transparent] [scrollbar-width:thin]">
              <table className="min-w-[680px] w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-[#f7f9fc] text-slate-500">
                    <th className="w-14 px-3 py-2 font-black">序号</th>
                    <th className="px-3 py-2 font-black">姓名</th>
                    <th className="px-3 py-2 font-black">排名</th>
                    <th className="px-3 py-2 font-black">KPI档位</th>
                    <th className="px-3 py-2 font-black">业绩排名变化</th>
                    <th className="px-3 py-2 font-black">综合能力</th>
                    <th className="px-3 py-2 font-black">趋势</th>
                    <th className="px-3 py-2 font-black">调档</th>
                  </tr>
                </thead>
                <tbody>
                  {session.rows.map((row) => {
                    const bandDelta = RANKING_BANDS.indexOf(row.currentBand) - RANKING_BANDS.indexOf(row.originalBand);
                    const adjusted = bandDelta !== 0;
                    const alertAdjustment = adjusted && row.adjustmentAlert;
                    const rowTone = alertAdjustment
                      ? "bg-[#fff2ed] ring-1 ring-inset ring-[#ff6b35]/35"
                      : bandDelta > 0
                        ? "bg-[#fff8f6]"
                        : bandDelta < 0
                          ? "bg-success-soft/25"
                          : "bg-white";
                    return (
                      <tr key={row.id} className={`border-t border-slate-100 ${rowTone}`}>
                        <td className="px-3 py-3 text-sm font-semibold text-slate-700">{row.rankNo}</td>
                        <td className="px-3 py-3">
                          <p className="font-black text-slate-900">{row.name}</p>
                          <p className="mt-0.5 max-w-[180px] truncate text-[11px] font-semibold text-slate-400">{row.title}</p>
                        </td>
                        <td className="px-3 py-3 font-bold text-slate-800">{row.rankNo}/{row.total}</td>
                        <td className="px-3 py-3">
                          <span className="rounded-md bg-primary-soft px-2 py-1 font-black text-primary">{row.originalBand}</span>
                        </td>
                        <td className="px-3 py-3 font-black text-slate-700">
                          {adjusted ? (
                            <div className="space-y-0.5">
                              <p>{row.originalBand}</p>
                              <p className={alertAdjustment ? "text-[#c2410c]" : bandDelta > 0 ? "text-[#c2410c]" : "text-success"}>{bandDelta > 0 ? "↓" : "↑"}</p>
                              <p className={alertAdjustment ? "text-[#c2410c]" : bandDelta > 0 ? "text-[#c2410c]" : "text-primary"}>{row.currentBand}</p>
                            </div>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-3 font-semibold text-slate-800">{row.ability}</td>
                        <td className="px-3 py-3 font-black text-[#ff6b35]">{row.trend}</td>
                        <td className="px-3 py-3">
                          <p className={`font-black ${alertAdjustment ? "text-[#c2410c]" : bandDelta > 0 ? "text-[#c2410c]" : bandDelta < 0 ? "text-success" : "text-slate-400"}`}>
                            {row.adjustmentNote ? (bandDelta > 0 ? `下调 ${Math.abs(bandDelta)}档` : `上调 ${Math.abs(bandDelta)}档`) : "—"}
                          </p>
                          {row.adjustmentNote && (
                            <p className={`mt-1 text-[11px] font-semibold ${alertAdjustment ? "text-[#c2410c]" : "text-slate-400"}`}>
                              {alertAdjustment ? "调档预警 · 需复核" : "一把手调节"}
                            </p>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </BotBubble>
    </div>
  );
}

function AssistantUtilityPanel({
  history,
  insight,
  sentRecord,
  onClose,
}: {
  history: any[];
  insight: AssistantInsight | null;
  sentRecord: { at: string; emailSent: boolean; emailPending?: boolean } | null;
  onClose: () => void;
}) {
  const recentItems = [
    ...(insight ? [{ id: "insight", title: insight.question, meta: "推荐提问 · 当前对话" }] : []),
    ...(sentRecord ? [{
      id: "sent",
      title: sentRecord.emailSent
        ? "反馈已录入系统，并已转发邮件"
        : sentRecord.emailPending
          ? "反馈已录入系统，待确认邮件"
          : "反馈已录入系统，未发送邮件",
      meta: new Date(sentRecord.at).toLocaleString("zh-CN"),
    }] : []),
    ...history.slice(0, 5).map((item) => ({
      id: item.id,
      title: `${item.sub_name || "下属"} · 综合评分 ${item.score}`,
      meta: `${new Date(item.created_at).toLocaleString("zh-CN")} · ${item.email_sent ? "已发送" : "未发送"}`,
    })),
  ];

  return (
    <div className="rounded-2xl border border-border/70 bg-white/95 p-3.5 shadow-[0_16px_38px_rgba(15,23,42,0.07)]">
      <div className="mb-3 flex items-center justify-between gap-3">
        <p className="text-sm font-bold">历史对话</p>
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-secondary hover:text-primary"
          aria-label="关闭面板"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="space-y-2">
        {recentItems.length > 0 ? recentItems.map((item) => (
          <div key={item.id} className="rounded-xl bg-primary-soft/35 px-3 py-2 ring-1 ring-primary/10">
            <p className="text-xs font-semibold text-foreground">{item.title}</p>
            <p className="mt-1 text-[11px] text-muted-foreground">{item.meta}</p>
          </div>
        )) : (
          <div className="rounded-xl bg-secondary/60 px-3 py-4 text-center text-xs text-muted-foreground">
            暂无历史对话，点击推荐提问或写反馈后会在这里记录。
          </div>
        )}
      </div>
    </div>
  );
}

function SuggestionPromptCard({
  title,
  text,
  featured,
  onClick,
}: {
  title: string;
  text: string;
  featured?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group min-h-[128px] rounded-2xl border border-border/70 bg-white/88 p-4 text-left shadow-[0_14px_36px_rgba(15,23,42,0.055)] transition hover:-translate-y-0.5 hover:border-primary/35 hover:shadow-[0_20px_44px_rgba(15,23,42,0.09)] ${
        featured ? "col-span-2" : ""
      }`}
    >
      <p className="bg-gradient-to-r from-primary to-accent-foreground bg-clip-text text-sm font-bold text-transparent">
        {title}
      </p>
      <p className="mt-5 text-lg font-semibold leading-snug text-foreground group-hover:text-primary">
        {text}
      </p>
    </button>
  );
}

function SuggestionInsightCard({
  insight,
  subs,
}: {
  insight: AssistantInsight;
  subs: Subordinate[];
}) {
  const notSubmitted = subs.filter((s) => s.status === "not_submitted" || s.status === "reminded");
  const pendingFeedback = subs.filter((s) => s.status === "pending_feedback");
  const confirmed = subs.filter((s) => s.status === "confirmed");
  const scoredSubs = subs.filter((s) => typeof s.score === "number");
  const avgScore = scoredSubs.length
    ? Math.round(scoredSubs.reduce((sum, s) => sum + (s.score || 0), 0) / scoredSubs.length)
    : 0;
  const zhou = subs.find((s) => s.name === "丁珂珂");

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border bg-white px-3.5 py-3">
        <p className="text-[11px] font-semibold text-muted-foreground">你的提问</p>
        <p className="mt-1 text-sm font-semibold">{insight.question}</p>
      </div>

      {insight.id === "missing_reports" && (
        <BotBubble>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold">本月未提交汇报：{notSubmitted.length} 人</p>
              <p className="mt-1 text-xs text-muted-foreground">
                已按当前组织架构状态统计，包含未提交和已催办但仍未提交的下属。
              </p>
            </div>
            {notSubmitted.length > 0 ? (
              <div className="space-y-2">
                {notSubmitted.map((sub) => (
                  <div key={sub.id} className="rounded-lg bg-white/75 px-3 py-2 ring-1 ring-border/70">
                    <div className="flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold">{sub.name}</p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground truncate">{sub.title}</p>
                      </div>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        sub.status === "reminded" ? "bg-warning-soft text-warning" : "bg-muted text-muted-foreground"
                      }`}>
                        {sub.status === "reminded" ? "已催办" : "未提交"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg bg-success-soft/55 px-3 py-2 text-sm text-success">本月下属汇报已全部提交。</p>
            )}
          </div>
        </BotBubble>
      )}

      {insight.id === "team_kpi" && (
        <BotBubble>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold">团队 KPI 完成情况</p>
              <p className="mt-1 text-xs text-muted-foreground">
                当前平均绩效分 {avgScore || "—"}，已确认 {confirmed.length} 人，待反馈 {pendingFeedback.length} 人，待提交 {notSubmitted.length} 人。
              </p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <MiniMetric label="已确认" value={confirmed.length} tone="success" />
              <MiniMetric label="待反馈" value={pendingFeedback.length} tone="primary" />
              <MiniMetric label="待提交" value={notSubmitted.length} tone="warning" />
            </div>
            <div className="space-y-2">
              {KPI_SCORE_ITEMS.map((item) => {
                const delta = item.self - item.last;
                return (
                  <div key={item.id} className="rounded-lg bg-white/75 px-3 py-2 ring-1 ring-border/70">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-semibold">{item.title}</p>
                      <span className="text-xs font-bold text-primary">{item.self}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      权重 {item.weight} · 较主考评分 {delta >= 0 ? `+${delta}` : delta} 分
                    </p>
                  </div>
                );
              })}
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              结论：丁珂珂4月核心 KPI 主考评分整体接近自评，建议优先核验个人份额提升、企康服务运营、K3-Hub&Spoke 和个非新口径追赶动作。
            </p>
          </div>
        </BotBubble>
      )}

      {insight.id === "zhou_trend" && (
        <BotBubble>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold">丁珂珂历史评价趋势</p>
              <p className="mt-1 text-xs text-muted-foreground">
                已在左侧选中丁珂珂。当前主考评分 {zhou?.score ?? 85}，4月反馈关注车险、个非、新客数和平台线销模式变革。
              </p>
            </div>
            <div className="space-y-2">
              {RANK_HISTORY.map((item) => (
                <div key={item.period} className="flex items-center justify-between rounded-lg bg-white/75 px-3 py-2 ring-1 ring-border/70">
                  <div>
                    <p className="text-xs font-semibold">{item.period}</p>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{item.ability}</p>
                  </div>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    item.tone === "success" ? "bg-success-soft text-success" : "bg-warning-soft text-warning"
                  }`}>
                    {item.band}
                  </span>
                </div>
              ))}
            </div>
            <div className="rounded-lg bg-white/75 px-3 py-2 ring-1 ring-border/70">
              <p className="text-xs font-semibold">近三个月主管反馈</p>
              <div className="mt-2 space-y-1.5">
                {HISTORY.map((item) => (
                  <p key={item.period} className="text-[11px] leading-relaxed text-muted-foreground">
                    <span className="font-semibold text-foreground">{item.period}：</span>{item.supervisor}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </BotBubble>
      )}
    </div>
  );
}

function MiniMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "success" | "primary" | "warning" | "muted";
}) {
  const toneCls = {
    success: "bg-success-soft text-success",
    primary: "bg-primary-soft text-primary",
    warning: "bg-warning-soft text-warning",
    muted: "bg-slate-100 text-slate-500",
  };
  return (
    <div className={`rounded-lg px-3 py-2 text-center ${toneCls[tone]}`}>
      <p className="text-[10px] font-semibold">{label}</p>
      <p className="mt-0.5 text-xl font-bold leading-none">{value}</p>
    </div>
  );
}

function GeneratedFeedback({
  sub, draft, initialDraft, versions, generating, sending, scores, onEdit, dialogueMessages, onConfirm,
}: {
  sub: Subordinate;
  draft: FeedbackDraft | null;
  initialDraft: FeedbackDraft | null;
  versions: FeedbackDraftVersion[];
  generating: boolean;
  sending: boolean;
  scores: Record<string, number>;
  onEdit: (text: string) => void;
  dialogueMessages: Array<{ id: string; role: "user" | "assistant"; text: string }>;
  onConfirm: () => void;
}) {
  if (generating || !draft) {
    return (
      <BotBubble>
        <div className="flex items-center gap-2 text-xs">
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
          AI 正在结合汇报、邮件、聊天记录生成反馈...
        </div>
      </BotBubble>
    );
  }

  const renderFeedbackCard = (
    cardDraft: FeedbackDraft,
    scoreMap: Record<string, number>,
    title: string,
    userPrompt?: string,
  ) => {
    const renderScoreList = (items: typeof KPI_SCORE_ITEMS | typeof KEY_WORK_SCORE_ITEMS) => (
    <div className="space-y-1.5">
      {items.map((item) => {
        const managerScore = scoreMap[item.id] ?? item.self;
        const optimized = cardDraft.optimizedItemIds?.includes(item.id);
        return (
          <div
            key={item.id}
            className={`rounded-xl px-3 py-2 ring-1 ${
              optimized
                ? "bg-[#fff8e6] ring-[#f5b400]/40 shadow-[0_0_0_1px_rgba(245,180,0,0.08)]"
                : "bg-white ring-border/70"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                item.tag === "核心KPI" ? "bg-primary-soft text-accent-foreground" : "bg-success-soft text-success"
              }`}>
                {item.tag}
              </span>
              <p className="min-w-0 flex-1 truncate text-xs font-semibold">{item.title}</p>
              {"weight" in item && item.weight && <span className="text-[10px] font-medium text-muted-foreground">{item.weight}</span>}
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>下属自评 <b className="text-foreground">{item.self}分</b></span>
              <span>主考评分 <b className="text-primary">{managerScore}分</b></span>
            </div>
            {cardDraft.scoreNotes?.[item.id] && (
              <p className="mt-1.5 rounded-lg bg-white/70 px-2 py-1 text-[11px] font-semibold leading-relaxed text-[#8a5a00]">
                {cardDraft.scoreNotes[item.id]}
              </p>
            )}
          </div>
        );
      })}
    </div>
    );

    return (
        <div className="overflow-hidden rounded-2xl rounded-tl-md border border-primary/15 bg-card shadow-[0_12px_34px_rgba(15,23,42,0.06)]">
          <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-primary-soft/70 px-3.5 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
              <span className="truncate text-xs font-semibold text-accent-foreground">{title}</span>
            </div>
            <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-primary shadow-sm">
              {cardDraft.score} 分
            </span>
          </div>

          <div className="space-y-3 p-3.5">
            {userPrompt && (
              <p className="rounded-xl bg-white px-3 py-2 text-[11px] font-semibold leading-relaxed text-muted-foreground ring-1 ring-border/70">
                修改要求：{userPrompt}
              </p>
            )}
            <div className="rounded-2xl bg-secondary/45 p-3">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold text-muted-foreground">综合评价</p>
                <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-primary">综合评分 {cardDraft.score}分</span>
              </div>
              <div className="mt-2 space-y-2 text-xs leading-5 text-foreground">
                <p className={cardDraft.optimized?.highlights ? "rounded-lg bg-[#fff8e6] px-2 py-1 ring-1 ring-[#f5b400]/35" : ""}>
                  <span className="font-semibold text-success">亮点：</span>{cardDraft.highlights}
                </p>
                <p className={cardDraft.optimized?.shortcomings ? "rounded-lg bg-[#fff8e6] px-2 py-1 ring-1 ring-[#f5b400]/35" : ""}>
                  <span className="font-semibold text-warning">不足：</span>{cardDraft.shortcomings}
                </p>
                <p className={cardDraft.optimized?.nextFocus ? "rounded-lg bg-[#fff8e6] px-2 py-1 ring-1 ring-[#f5b400]/35" : ""}>
                  <span className="font-semibold text-primary">下月重点：</span>{cardDraft.nextFocus}
                </p>
              </div>
            </div>

            <div className="rounded-2xl bg-secondary/30 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold text-muted-foreground">核心 KPI</p>
                <span className="text-[10px] text-muted-foreground">
                  加权主考 {computeWeightedScore(KPI_SCORE_ITEMS, scoreMap)}分
                </span>
              </div>
              {renderScoreList(KPI_SCORE_ITEMS)}
            </div>

            <div className="rounded-2xl bg-secondary/30 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-[11px] font-semibold text-muted-foreground">关键工作</p>
                <span className="text-[10px] text-muted-foreground">
                  平均主考 {computeAverageScore(KEY_WORK_SCORE_ITEMS, scoreMap)}分
                </span>
              </div>
              {renderScoreList(KEY_WORK_SCORE_ITEMS)}
            </div>
          </div>
        </div>
    );
  };

  const firstDraft = initialDraft ?? draft;
  const initialPromptMessage = dialogueMessages.find((message) => message.role === "user");
  const initialFeedbackPrompt = initialPromptMessage?.text ?? `帮我写${getFeedbackRecipientName(sub)}的反馈`;
  const ignoredMessageIds = new Set([
    initialPromptMessage?.id,
    dialogueMessages.find((message) =>
      message.role === "assistant" && /正在打开.*绩效详情.*生成反馈初稿/.test(message.text)
    )?.id,
  ].filter(Boolean));
  const remainingDialogueMessages = dialogueMessages.filter((message) => !ignoredMessageIds.has(message.id));
  const versionInstructions = new Set(versions.map((version) => version.instruction));
  const extraDialogueMessages = remainingDialogueMessages.filter((message) =>
    message.role !== "user" || !versionInstructions.has(message.text)
  );

  return (
    <>
      <div className="space-y-3">
        <div className="ml-auto max-w-[82%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-xs font-medium leading-relaxed text-primary-foreground shadow-sm">
          {initialFeedbackPrompt}
        </div>

        {renderFeedbackCard(firstDraft, getDefaultFeedbackScores(), "AI 已生成反馈草稿")}

        {versions.map((version, index) => (
          <div key={version.id} className="space-y-2">
            <div className="ml-auto max-w-[82%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-xs font-medium leading-relaxed text-primary-foreground shadow-sm">
              {version.instruction}
            </div>
            {renderFeedbackCard(version.draft, version.scores, `AI 根据修改意见生成的新反馈 V${index + 2}`, version.instruction)}
          </div>
        ))}

        <AssistantDialogueMessages messages={extraDialogueMessages} />

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => onEdit(getFeedbackText(draft))}
            className="flex items-center justify-center gap-1.5 rounded-xl border border-primary/30 bg-card py-2.5 text-xs font-medium text-primary transition hover:border-primary/50 hover:bg-primary-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <Pencil className="h-3.5 w-3.5" /> 修订
          </button>
          <button
            disabled={sending}
            onClick={onConfirm}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-primary py-2.5 text-xs font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90 hover:shadow focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            确认
          </button>
        </div>
      </div>
    </>
  );
}

function ScoreRow({
  tag, tagColor, title, value, placeholder, invalid, onChange,
}: {
  tag: string;
  tagColor: "kpi" | "work";
  title: string;
  value: number | undefined;
  placeholder: string;
  invalid: boolean;
  onChange: (v: number | undefined) => void;
}) {
  const tagCls = tagColor === "kpi"
    ? "bg-primary-soft text-accent-foreground"
    : "bg-success-soft text-success";
  return (
    <div className="flex items-center gap-2 rounded-xl px-2 py-2.5 transition hover:bg-secondary/45">
      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${tagCls}`}>{tag}</span>
      <span className="text-sm flex-1 truncate">{title}</span>
      <input
        type="number"
        min={0}
        max={100}
        value={value ?? ""}
        placeholder={placeholder}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "") return onChange(undefined);
          const n = Math.max(0, Math.min(100, Number(v)));
          onChange(Number.isFinite(n) ? n : undefined);
        }}
        className={`w-16 h-9 text-center text-sm rounded-md border bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 ${
          invalid ? "border-destructive ring-2 ring-destructive/20" : "border-border"
        }`}
      />
    </div>
  );
}

function EditFeedbackCard({
  draft, scores, onClose, onSave,
}: {
  draft: FeedbackDraft;
  scores: Record<string, number>;
  onClose: () => void;
  onSave: (d: FeedbackDraft, scores: Record<string, number>) => void;
}) {
  const [score, setScore] = useState(draft.score);
  const [highlights, setHighlights] = useState(draft.highlights);
  const [shortcomings, setShortcomings] = useState(draft.shortcomings);
  const [nextFocus, setNextFocus] = useState(draft.nextFocus);
  const [localScores, setLocalScores] = useState(scores);
  const fieldCls =
    "mt-2 w-full resize-y rounded-2xl border border-border bg-primary-soft/20 px-4 py-3 text-xs leading-5 text-foreground focus:border-primary/35 focus:outline-none focus:ring-2 focus:ring-primary/20";
  const updateLocalScore = (id: string, value: number | undefined) => {
    const next = { ...localScores };
    if (value == null) delete next[id];
    else next[id] = value;
    setLocalScores(next);
  };
  const save = () => {
    onSave({
      ...draft,
      score,
      highlights,
      shortcomings,
      nextFocus,
      feedbackText: getFeedbackText({ ...draft, score, highlights, shortcomings, nextFocus }),
    }, localScores);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-slate-950/25 px-4 pt-16">
      <section className="flex max-h-[84vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-[0_28px_90px_rgba(15,23,42,0.24)]">
        <div className="flex items-center justify-between border-b border-border bg-primary-soft/45 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-primary" />
            <p className="font-semibold text-sm">修订下属月度反馈</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary transition">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-4">
          <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <div className="flex items-center gap-3">
              <p className="min-w-0 flex-1 text-xs font-semibold text-muted-foreground">综合评价</p>
              <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                综合评分
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={score}
                  onChange={(e) => {
                    const next = normalizeScore(e.target.value);
                    if (next != null) setScore(next);
                  }}
                  className="h-9 w-20 rounded-lg border border-border bg-white text-center text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </label>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <label className="block">
                <span className="text-xs font-semibold text-success">亮点</span>
                <textarea value={highlights} onChange={(e) => setHighlights(e.target.value)} rows={6} className={fieldCls} />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-warning">不足</span>
                <textarea value={shortcomings} onChange={(e) => setShortcomings(e.target.value)} rows={6} className={fieldCls} />
              </label>
              <label className="block">
                <span className="text-xs font-semibold text-primary">下月重点</span>
                <textarea value={nextFocus} onChange={(e) => setNextFocus(e.target.value)} rows={6} className={fieldCls} />
              </label>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <div className="mb-3">
              <p className="text-xs font-semibold text-muted-foreground">核心 KPI 主考评分</p>
              <p className="mt-1 text-[11px] text-muted-foreground">默认使用下属自评分，可按主考判断调整。</p>
            </div>
            <div className="space-y-1">
              {KPI_SCORE_ITEMS.map((it) => (
                <ScoreRow
                  key={it.id}
                  tag={it.tag}
                  tagColor="kpi"
                  title={`${it.title}（${it.weight}）`}
                  value={localScores[it.id]}
                  placeholder={String(it.self)}
                  invalid={false}
                  onChange={(v) => updateLocalScore(it.id, v)}
                />
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-white p-4 shadow-sm">
            <div className="mb-3">
              <p className="text-xs font-semibold text-muted-foreground">关键工作主考评分</p>
              <p className="mt-1 text-[11px] text-muted-foreground">默认使用下属自评分，可按实际产出调整。</p>
            </div>
            <div className="space-y-1">
              {KEY_WORK_SCORE_ITEMS.map((it) => (
                <ScoreRow
                  key={it.id}
                  tag={it.tag}
                  tagColor="work"
                  title={it.title}
                  value={localScores[it.id]}
                  placeholder={String(it.self)}
                  invalid={false}
                  onChange={(v) => updateLocalScore(it.id, v)}
                />
              ))}
            </div>
          </section>
        </div>
        <div className="flex gap-2 border-t border-border bg-secondary/20 p-4">
          <button
            onClick={onClose}
            className="flex-1 py-2 rounded-lg border border-primary/30 bg-card text-primary text-xs font-medium hover:bg-primary-soft transition"
          >
            取消
          </button>
          <button
            onClick={save}
            className="flex-[2] py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium shadow-sm hover:bg-primary/90 transition"
          >
            保存修改
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

/* ===================== PERSONAL REPORT FLOW ===================== */

type PersonalItem = {
  id: string;
  tag: "核心KPI" | "关键工作";
  title: string;
  weight?: string;
  w?: number;
  goal: string;
  aiNote: string;
};

const PERSONAL_ITEMS: PersonalItem[] = [
  { id: "p1", tag: "核心KPI", title: "考核利润", weight: "50%", w: 0.5, goal: "底线xxx亿、市场线xxx亿、计划线xxx亿、标杆线xxx亿",
    aiNote: "本月考核利润自评92.6分，年化xx亿，整体利润表现保持在较优水平。" },
  { id: "p2", tag: "核心KPI", title: "份额提升", weight: "25%", w: 0.25, goal: "底线x%、市场线x%、计划线x%、标杆线xx%",
    aiNote: "份额提升自评89.5分，预估xxpt；新能源车份额持续提升，预估4月份份额28.0%，同比提升0.3pt。" },
  { id: "p3", tag: "核心KPI", title: "COR优于市场", weight: "25%", w: 0.25, goal: "底线x%、市场线x%、计划线x%、标杆线xx%",
    aiNote: "COR优于市场自评92分，预估xxpt，风险综合评级和科技监管工作继续保持行业领先。" },
  { id: "p4", tag: "关键工作", title: "车险两地牌照一体化管理", goal: "根据集团要求，4月底前汇报马总",
    aiNote: "完成香港车险市场洞察、两地车业务战略目标和核心举措梳理，提出短期聚焦两地车、长期建设全方位能力体系的方案。" },
  { id: "p5", tag: "关键工作", title: "非车发展策略", goal: "健康险、宠物险、小微综合保险、企康按年度目标推进",
    aiNote: "健康险、宠物险、小微综合保险和企康4月均有关键指标达成，其中健康险保费68.7亿、宠物险保费8580万、企康央国企占比94%。" },
  { id: "p6", tag: "关键工作", title: "车险HS发展策略", goal: "潜客100万、主体覆盖率60%、机构渗透率60%",
    aiNote: "4月潜客30万，主体覆盖率54%，机构渗透率53%；新跑通建信、中银两家主体并推进2C、2B平台建设。" },
  { id: "p7", tag: "关键工作", title: "压舱石提升", goal: "3年优质底仓占比与收益贡献超2/3，力争逆转NII下降趋势",
    aiNote: "4月末NII预估达成1.02%，全年预估NII较计划提升40bp至2.6%；压舱石占比70.6%，较年初提升1.9pt。" },
];

type PersonalReport = {
  score: number;
  summary: string;
  items: Array<{
    id: string;
    tag: PersonalItem["tag"];
    title: string;
    weight?: string;
    goal: string;
    note: string;
    score: number;
  }>;
  optimized?: {
    summary?: boolean;
    itemIds?: string[];
  };
  midyear?: MidyearReportDetails;
};

type MidyearContributionKey = "newPerformance" | "newContribution" | "newInnovation" | "newImprovement" | "other";

type MidyearReportDetails = {
  contributions: Record<MidyearContributionKey, string>;
  regrets: string[];
  attachmentAdvice: string;
  attachments: Array<{
    id: string;
    name: string;
    size: number;
    type: string;
    lastModified: number;
  }>;
};

const MIDYEAR_CONTRIBUTION_FIELDS: Array<{ key: MidyearContributionKey; label: string }> = [
  { key: "newPerformance", label: "新业绩" },
  { key: "newContribution", label: "新贡献" },
  { key: "newInnovation", label: "新创新" },
  { key: "newImprovement", label: "新提升" },
  { key: "other", label: "其他" },
];

const DEFAULT_MIDYEAR_DETAILS: MidyearReportDetails = {
  contributions: {
    newPerformance: "上半年围绕考核利润、份额提升和COR优于市场形成阶段性结果，核心经营指标整体保持稳健。",
    newContribution: "推动车险两地牌照、非车发展策略、HS模式突破和压舱石提升等重点任务，为下半年经营目标打基础。",
    newInnovation: "推进AI工具融入经营分析、组织转型和重点项目管理，沉淀可复制的方法和工具模板。",
    newImprovement: "在跨部门协同、风险预警、经营复盘和重点项目里程碑管理方面持续提升。",
    other: "建议补充客户反馈、组织协同、监管沟通或标杆案例等额外亮点。",
  },
  regrets: [
    "部分专项工作仍需进一步压实阶段目标，关键里程碑和责任分工需要更清晰。",
    "对跨部门推进事项的风险预警和过程复盘还不够前置，部分问题暴露后闭环节奏仍可提升。",
    "部分数据化呈现和附件依据不够充分，后续需增强事实支撑和成果沉淀。",
  ],
  attachmentAdvice: "建议上传：1-6月核心KPI看板、重点项目里程碑材料、客户或监管反馈、会议纪要、成果截图和相关附件。",
  attachments: [],
};

function cloneMidyearReportDetails(details?: MidyearReportDetails): MidyearReportDetails {
  return {
    contributions: { ...DEFAULT_MIDYEAR_DETAILS.contributions, ...(details?.contributions ?? {}) },
    regrets: details?.regrets?.length ? [...details.regrets] : [...DEFAULT_MIDYEAR_DETAILS.regrets],
    attachmentAdvice: details?.attachmentAdvice ?? DEFAULT_MIDYEAR_DETAILS.attachmentAdvice,
    attachments: details?.attachments?.length ? [...details.attachments] : [],
  };
}

function formatAttachmentSize(size: number) {
  if (size >= 1024 * 1024) return `${(size / 1024 / 1024).toFixed(1)} MB`;
  if (size >= 1024) return `${Math.max(1, Math.round(size / 1024))} KB`;
  return `${size} B`;
}

type PersonalReportVersion = {
  id: string;
  instruction: string;
  report: PersonalReport;
};

const PERSONAL_REPORT_EMAIL_SUPERVISOR = CURRENT_USER.supervisor;
const PERSONAL_REPORT_EMAIL_CC = "孔捷";

function getDefaultPersonalSelfScore(item: PersonalItem) {
  const map: Record<string, number> = {
    p1: 93,
    p2: 90,
    p3: 92,
    p4: 88,
    p5: 87,
    p6: 86,
    p7: 88,
  };
  return map[item.id] ?? 85;
}

function buildPersonalReport(
  notes: Record<string, string>,
  scoreMap: Record<string, number | undefined>,
): PersonalReport {
  const items = PERSONAL_ITEMS.map((item) => ({
    id: item.id,
    tag: item.tag,
    title: item.title,
    weight: item.weight,
    goal: item.goal,
    note: notes[item.id] || item.aiNote,
    score: scoreMap[item.id] ?? getDefaultPersonalSelfScore(item),
  }));
  const kpiItems = items.filter((item) => item.tag === "核心KPI");
  const workItems = items.filter((item) => item.tag === "关键工作");
  const weighted = kpiItems.reduce((sum, item) => {
    const source = PERSONAL_ITEMS.find((personalItem) => personalItem.id === item.id);
    return sum + item.score * (source?.w ?? 0);
  }, 0);
  const weightSum = PERSONAL_ITEMS.reduce((sum, item) => sum + (item.w ?? 0), 0);
  const score = weightSum ? Math.round(weighted / weightSum) : Math.round(items.reduce((sum, item) => sum + item.score, 0) / items.length);
  const summary = [
    "一、重点工作进展：",
    `本月围绕核心 KPI 与关键工作整体推进稳定，综合自评分建议为 ${score} 分。`,
    `核心 KPI：${kpiItems.map((item) => `${item.title}${item.score}分，${item.note}`).join("；")}。`,
    `关键工作：${workItems.map((item) => `${item.title}${item.score}分，${item.note}`).join("；")}。`,
    "",
    "二、存在不足：",
    "部分专项工作仍需进一步压实阶段目标、明确协同边界和里程碑检查机制；对跨部门推进事项的风险预警、过程复盘和数据化呈现还可以继续加强。",
    "",
    "三、下月重点工作：",
    "继续聚焦长护险研究、海外业务和十五五规划布局，推进产险班子分工规划；同步跟踪核心 KPI 缺口，按周复盘关键工作节点，确保重点项目按计划闭环。",
  ].join("\n");

  return { score, summary, items };
}

function buildMidyearPersonalReport(): PersonalReport {
  const base = buildPersonalReport(
    Object.fromEntries(PERSONAL_ITEMS.map((item) => [
      item.id,
      item.aiNote
        .replace(/本月|4月/g, "上半年")
        .replace(/下月/g, "下阶段"),
    ])),
    Object.fromEntries(PERSONAL_ITEMS.map((item) => [item.id, getDefaultPersonalSelfScore(item)])),
  );
  const kpiItems = base.items.filter((item) => item.tag === "核心KPI");
  const workItems = base.items.filter((item) => item.tag === "关键工作");
  const midyear = cloneMidyearReportDetails();
  return {
    ...base,
    summary: [
      "一、核心KPI汇报：",
      kpiItems.map((item) => `${item.title}（${item.weight ?? "无权重"}）自评分${item.score}分：${item.note}`).join("\n"),
      "",
      "二、关键工作汇报：",
      workItems.map((item) => `${item.title}自评分${item.score}分：${item.note}`).join("\n"),
      "",
      "三、主要贡献及亮点：",
      MIDYEAR_CONTRIBUTION_FIELDS.map((field) => `${field.label}：${midyear.contributions[field.key]}`).join("\n"),
      "",
      "四、不足及遗憾：",
      midyear.regrets.map((item, index) => `${index + 1}. ${item}`).join("\n"),
      "",
      "五、附件建议：",
      midyear.attachmentAdvice,
    ].join("\n"),
    midyear,
  };
}

function buildSubmittedPersonalMonthlyReport(
  report: PersonalReport,
  period = getCurrentMonthPeriod(),
): SubmittedPersonalMonthlyReport {
  const submittedAt = new Date().toLocaleString("zh-CN", {
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

  return {
    report: {
      period,
      submittedAt,
      original: report.summary,
      highlights: report.summary,
      shortcomings: "待主考反馈后补充。",
      nextFocus: "待主考反馈后补充。",
    },
    metrics: report.items.map((item) => ({
      tag: item.tag === "核心KPI" ? "核心 KPI" : "关键工作",
      title: item.title,
      goal: item.goal,
      weight: item.weight ?? "-",
      self: item.score,
      last: "",
      current: String(item.score),
      note: item.note,
    })),
  };
}

function getPersonalReportOptimizationTargets(instruction: string) {
  const compact = instruction.replace(/\s/g, "");
  const itemIds = new Set<string>();
  if (/车险|两地|粤港|牌照|香港/.test(compact)) itemIds.add("p4");
  if (/非车|健康|宠物|小微|企康/.test(compact)) itemIds.add("p5");
  if (/HS|监管|联盟|再保|机构运营/i.test(compact)) itemIds.add("p6");
  if (/利润|盈利|压舱石|NII|投资/.test(compact)) {
    itemIds.add("p1");
    itemIds.add("p7");
  }
  if (/份额|新客|市场/.test(compact)) itemIds.add("p2");
  if (/COR|成本|风控|风险/.test(compact)) itemIds.add("p3");
  if (itemIds.size === 0) {
    itemIds.add("p2");
    itemIds.add("p5");
    itemIds.add("p6");
  }
  return [...itemIds];
}

const PERSONAL_REPORT_REVISION_LIBRARY: Record<string, { summary: string; note: string }> = {
  p1: {
    summary: "考核利润部分补充利润质量、承保质量和压舱石收益对经营结果的支撑。",
    note: "本版将利润进展拆到承保质量、费用效率和收益贡献三个口径，5月需按周跟踪高赔业务治理、费用消耗和NII改善，形成利润质量复盘。",
  },
  p2: {
    summary: "份额提升部分补充新能源、新车高增品牌、转保转化和客户分层补缺路径。",
    note: "本版将份额提升改写为新车高增品牌、转保链路和C/B/P客户分层三条动作线，5月底前需明确缺口、责任人和追赶节奏。",
  },
  p3: {
    summary: "COR优于市场部分补充风控、定价、科技监管和高赔机构治理动作。",
    note: "本版将COR进展聚焦到高赔机构治理、风险定价和科技监管穿透，5月需形成偏离机构清单、治理动作和周度复盘。",
  },
  p4: {
    summary: "车险两地牌照一体化部分补充粤港跨境车落地方案、追踪考核和短中长期能力建设。",
    note: "本版将两地牌照工作改写为粤港跨境车落地方案、追踪考核机制和能力建设路线，5月底前完成方案闭环和责任分解。",
  },
  p5: {
    summary: "非车发展策略部分补充健康险、宠物险、小微综合保险和企康的年度目标拆解。",
    note: "本版将非车发展拆成健康险、宠物险、小微综合保险和企康四条线，5月需明确年度目标差距、机构责任人和补缺里程碑。",
  },
  p6: {
    summary: "HS策略部分补充监管沟通、再保分润、联盟客户运营和机构提前运营方案。",
    note: "本版将HS策略聚焦为分机构监管沟通清单、再保分润试点、联盟客户运营和机构提前运营，5月需跑通试点并沉淀可推广模板。",
  },
  p7: {
    summary: "压舱石提升部分补充优质底仓占比、NII改善和收益贡献的持续跟踪。",
    note: "本版将压舱石提升改写为优质底仓占比、NII改善和收益贡献三项追踪，5月需明确达成口径、风险边界和复盘频率。",
  },
};

function rewritePersonalReport(report: PersonalReport, instruction: string) {
  const itemIds = getPersonalReportOptimizationTargets(instruction);
  const delta = getInstructionScoreDelta(instruction);
  const scoreOverride = getInstructionScoreOverride(instruction);
  const strict = delta < 0;
  const positive = delta > 0;
  const nextItems = report.items.map((item) => {
    if (!itemIds.includes(item.id)) return item;
    const revision = PERSONAL_REPORT_REVISION_LIBRARY[item.id];
    const score = scoreOverride ?? Math.max(0, Math.min(100, item.score + delta));
    const scoreText = strict
      ? "评分同步按更严格口径压实，未完成里程碑不计为充分达成。"
      : positive
        ? "评分同步体现阶段成果和可复制经验。"
        : "评分保持原口径，重点补充过程依据。";
    return {
      ...item,
      score,
      note: `${revision?.note ?? item.note}${scoreText}`,
    };
  });
  const kpiItems = nextItems.filter((item) => item.tag === "核心KPI");
  const weighted = kpiItems.reduce((sum, item) => {
    const source = PERSONAL_ITEMS.find((personalItem) => personalItem.id === item.id);
    return sum + item.score * (source?.w ?? 0);
  }, 0);
  const weightSum = PERSONAL_ITEMS.reduce((sum, item) => sum + (item.w ?? 0), 0);
  const revisionSummaries = itemIds
    .map((id) => PERSONAL_REPORT_REVISION_LIBRARY[id]?.summary)
    .filter(Boolean);
  const baseSummary = stripPriorRevisionFragments(report.summary)
    .replace(/\n\n根据补充要求优化：[\s\S]*$/, "")
    .trim();
  const summary = appendDistinctSentences(baseSummary, [
    `本版根据“${instruction}”重新生成。`,
    ...revisionSummaries,
    strict ? "涉及评分的部分已按更严格口径同步调整，突出未闭环事项和5月底验收要求。" : "",
    positive ? "本版进一步突出已完成成果、可复制经验和对核心KPI的贡献。" : "",
  ]);

  return {
    ...report,
    score: weightSum ? Math.round(weighted / weightSum) : report.score,
    summary,
    items: nextItems,
    optimized: { summary: true, itemIds },
  };
}

function buildPersonalReportEmailDraft(report: PersonalReport, cycle: ReportGuideCycle = "monthly"): FeedbackEmailDraft {
  const progressRows = report.items.map((item, index) =>
    `${index + 1}、${item.tag}｜${item.title}${item.weight ? `｜权重${item.weight}` : ""}｜自评分${item.score}分\n${item.note}`,
  ).join("\n");
  if (cycle === "midyear") {
    return {
      to: PERSONAL_REPORT_EMAIL_SUPERVISOR,
      cc: PERSONAL_REPORT_EMAIL_CC,
      subject: "【请审阅】年中绩效汇报-龙泉",
      body: `郭总好，\n我的年中绩效汇报如下，请您审阅。\n\n${getPersonalReportPreviewText(report, "midyear")}`,
    };
  }

  return {
    to: PERSONAL_REPORT_EMAIL_SUPERVISOR,
    cc: PERSONAL_REPORT_EMAIL_CC,
    subject: "【请审阅】4月绩效汇报-龙泉",
    body: `郭总好，\n我的四月月度汇报如下，请您审阅。\n\n综合汇报：\n1、本月核心工作进展：\n${report.summary}\n\n2、存在不足：\n需继续关注车险及个非发展、新客增长、平台与线销模式变革、重点机构帮扶和AI组织转型落地节奏。\n\n3、下月工作计划：\n聚焦长护险研究、海外业务和十五五规划布局、班子分工、HS模式突破、AI工具推广及K6组织相关工作，按月追踪关键里程碑。\n\n核心KPI及关键工作进展：\n${progressRows}\n\n综合自评分：${report.score}分`,
  };
}

function getPersonalReportPreviewText(report: PersonalReport, cycle: ReportGuideCycle = "monthly") {
  const progressRows = report.items.map((item, index) =>
    `${index + 1}、${item.tag}｜${item.title}${item.weight ? `｜权重${item.weight}` : ""}｜自评分${item.score}分\n${item.note}`,
  ).join("\n\n");
  if (cycle === "midyear") {
    const details = cloneMidyearReportDetails(report.midyear);
    return `核心KPI汇报：\n${report.items.filter((item) => item.tag === "核心KPI").map((item, index) => `${index + 1}. ${item.title}${item.weight ? `（权重${item.weight}）` : ""}｜目标描述：${item.goal}｜自评分${item.score}分\n${item.note}`).join("\n\n")}\n\n关键工作汇报：\n${report.items.filter((item) => item.tag === "关键工作").map((item, index) => `${index + 1}. ${item.title}｜时间计划/目标描述：${item.goal}｜自评分${item.score}分\n${item.note}`).join("\n\n")}\n\n主要贡献及亮点：\n${MIDYEAR_CONTRIBUTION_FIELDS.map((field) => `${field.label}：${details.contributions[field.key]}`).join("\n")}\n\n不足及遗憾：\n${details.regrets.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n\n附件建议：\n${details.attachmentAdvice}\n\n已上传附件：\n${details.attachments.length ? details.attachments.map((file, index) => `${index + 1}. ${file.name}（${formatAttachmentSize(file.size)}）`).join("\n") : "暂无"}\n\n综合自评分：${report.score}分`;
  }
  return `综合汇报：\n1、本月核心工作进展：\n${report.summary}\n\n2、存在不足：\n需继续关注车险及个非发展、新客增长、平台与线销模式变革、重点机构帮扶和AI组织转型落地节奏。\n\n3、下月工作计划：\n聚焦长护险研究、海外业务和十五五规划布局、班子分工、HS模式突破、AI工具推广及K6组织相关工作，按月追踪关键里程碑。\n\n核心KPI及关键工作进展：\n${progressRows}\n\n综合自评分：${report.score}分`;
}

function PersonalReportFlow({
  mode, setMode, dialogueMessages, externalInstruction, onExternalInstructionHandled, onConfirmed,
}: {
  mode: AIMode;
  setMode: (m: AIMode) => void;
  dialogueMessages: Array<{ id: string; role: "user" | "assistant"; text: string }>;
  externalInstruction: { id: number; text: string } | null;
  onExternalInstructionHandled: (response: string) => void;
  onConfirmed: (report: SubmittedPersonalMonthlyReport) => void;
}) {
  const [notes, setNotes] = useState<Record<string, string>>(
    () => Object.fromEntries(PERSONAL_ITEMS.map((i) => [i.id, i.aiNote])),
  );
  const [scores, setScores] = useState<Record<string, number | undefined>>(
    () => Object.fromEntries(PERSONAL_ITEMS.map((item) => [item.id, getDefaultPersonalSelfScore(item)])),
  );
  const [report, setReport] = useState<PersonalReport | null>(null);
  const [initialReport, setInitialReport] = useState<PersonalReport | null>(null);
  const [reportVersions, setReportVersions] = useState<PersonalReportVersion[]>([]);
  const [generating, setGenerating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emailDraft, setEmailDraft] = useState<FeedbackEmailDraft | null>(null);
  const [executionStatus, setExecutionStatus] = useState<"saved" | "email_sent" | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const generate = () => {
    setGenerating(true);
    setMode("personal_generated");
    setTimeout(() => {
      const generatedReport = buildPersonalReport(notes, scores);
      setReport(generatedReport);
      setInitialReport(generatedReport);
      setReportVersions([]);
      setGenerating(false);
    }, 900);
  };

  useEffect(() => {
    if (!externalInstruction || mode !== "personal_generated" || !report) return;
    const instruction = externalInstruction.text;
    const timer = window.setTimeout(() => {
      const sourceReport = reportVersions.at(-1)?.report ?? report;
      const nextReport = rewritePersonalReport(sourceReport, instruction);
      setNotes((currentNotes) => ({
        ...currentNotes,
        ...Object.fromEntries(nextReport.items.filter((item) => nextReport.optimized?.itemIds?.includes(item.id)).map((item) => [item.id, item.note])),
      }));
      setScores((currentScores) => ({
        ...currentScores,
        ...Object.fromEntries(nextReport.items.filter((item) => nextReport.optimized?.itemIds?.includes(item.id)).map((item) => [item.id, item.score])),
      }));
      setReport(nextReport);
      setReportVersions((versions) => [
        ...versions,
        { id: `rv-${Date.now()}`, instruction, report: nextReport },
      ]);
      onExternalInstructionHandled("");
    }, 650);
    return () => window.clearTimeout(timer);
  }, [externalInstruction, mode, report, onExternalInstructionHandled]);

  const submitToSystem = async (targetReport = report) => {
    if (!targetReport) return false;
    setSubmitting(true);
    await new Promise((resolve) => window.setTimeout(resolve, 550));
    onConfirmed(buildSubmittedPersonalMonthlyReport(targetReport));
    setExecutionStatus("saved");
    setSubmitting(false);
    return true;
  };

  const submitAndOpenEmail = async (targetReport = report) => {
    if (!targetReport) return;
    const ok = await submitToSystem(targetReport);
    if (ok) setEmailDraft(buildPersonalReportEmailDraft(targetReport));
  };

  const confirmEmailSend = () => {
    setEmailDraft(null);
    setExecutionStatus("email_sent");
    toast.success(`汇报邮件已发送给 ${PERSONAL_REPORT_EMAIL_SUPERVISOR}，并抄送 ${PERSONAL_REPORT_EMAIL_CC}`);
  };

  useEffect(() => {
    if (mode === "personal_scoring") generate();
  }, [mode]);

  const initialPromptMessage = dialogueMessages.find((message) => message.role === "user");
  const initialReportPrompt = initialPromptMessage?.text ?? "帮我总结下5月汇报";
  const followupDialogueMessages = initialPromptMessage
    ? dialogueMessages.filter((message) => message.id !== initialPromptMessage.id)
    : dialogueMessages;

  if (mode === "personal_scoring") {
    return (
      <>
        <div className="ml-auto max-w-[82%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-xs font-medium leading-relaxed text-primary-foreground shadow-sm">
          {initialReportPrompt}
        </div>
        <BotBubble>
          <div className="flex items-center gap-2 text-xs">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            AI 正在一次性生成综合汇报、核心 KPI 与关键工作自评。
          </div>
        </BotBubble>
      </>
    );
  }

  if (mode === "personal_generated") {
    if (generating || !report) {
      return (
        <BotBubble>
          <div className="flex items-center gap-2 text-xs">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            AI 正在结合绩效目标和上月自评分生成月度汇报...
          </div>
        </BotBubble>
      );
    }

    if (executionStatus) {
      return (
        <>
          <div className="ml-auto max-w-[82%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-xs font-medium leading-relaxed text-primary-foreground shadow-sm">
            {initialReportPrompt}
          </div>
          <BotBubble>
            <div className="flex items-start gap-2 text-xs">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-success" />
              <div>
                <p className="font-semibold text-success">
                  {executionStatus === "email_sent" ? "已录入系统，并已发送汇报邮件。" : "已录入系统。"}
                </p>
                <p className="mt-1 leading-relaxed text-muted-foreground">
                  左侧个人绩效汇报状态已同步更新为已提交。
                  {executionStatus === "email_sent" ? ` 邮件收件人：${PERSONAL_REPORT_EMAIL_SUPERVISOR}；抄送：${PERSONAL_REPORT_EMAIL_CC}。` : ""}
                </p>
              </div>
            </div>
          </BotBubble>
          {emailDraft && (
            <FeedbackEmailDialog
              draft={emailDraft}
              subName={CURRENT_USER.name}
              sending={false}
              onChange={setEmailDraft}
              onClose={() => setEmailDraft(null)}
              onConfirm={confirmEmailSend}
            />
          )}
        </>
      );
    }

    const renderReportCard = (cardReport: PersonalReport, title: string, instruction?: string) => (
      <div className="rounded-2xl border border-primary/20 bg-card shadow-sm overflow-hidden">
        <div className="bg-primary-soft px-3.5 py-2.5 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate text-xs font-semibold text-accent-foreground">{title}</span>
          </div>
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] font-bold text-primary">{cardReport.score} 分</span>
        </div>
        <div className="space-y-3 p-3.5">
          {instruction && (
            <p className="rounded-xl bg-white px-3 py-2 text-[11px] font-semibold leading-relaxed text-muted-foreground ring-1 ring-border/70">
              修改要求：{instruction}
            </p>
          )}
          <div className="rounded-2xl bg-secondary/45 p-3">
            <p className="text-[11px] font-semibold text-muted-foreground">综合汇报</p>
            <p className={`mt-2 whitespace-pre-wrap text-xs leading-5 text-foreground ${
              cardReport.optimized?.summary ? "rounded-lg bg-[#fff8e6] px-2 py-1 ring-1 ring-[#f5b400]/35" : ""
            }`}>{cardReport.summary}</p>
          </div>
          <div className="space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground">核心 KPI 与关键工作自评</p>
            {cardReport.items.map((item) => (
              <div
                key={item.id}
                className={`rounded-xl px-3 py-2 ring-1 ${
                  cardReport.optimized?.itemIds?.includes(item.id)
                    ? "bg-[#fff8e6] ring-[#f5b400]/40 shadow-[0_0_0_1px_rgba(245,180,0,0.08)]"
                    : "bg-white ring-border/70"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    item.tag === "核心KPI" ? "bg-primary-soft text-accent-foreground" : "bg-success-soft text-success"
                  }`}>{item.tag}</span>
                  <p className="min-w-0 flex-1 truncate text-xs font-semibold">{item.title}</p>
                  {item.weight && <span className="text-[10px] text-muted-foreground">{item.weight}</span>}
                  <span className="text-xs font-bold text-primary">{item.score}分</span>
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{item.note}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
    const firstReport = initialReport ?? report;

    return (
      <>
        <div className="ml-auto max-w-[82%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-xs font-medium leading-relaxed text-primary-foreground shadow-sm">
          {initialReportPrompt}
        </div>
        {renderReportCard(firstReport, "AI 总结的5月汇报")}
        <AssistantDialogueMessages messages={followupDialogueMessages} />
        {reportVersions.map((version, index) => (
          <div key={version.id}>
            {renderReportCard(version.report, `AI 根据修改意见生成的新汇报 V${index + 2}`, version.instruction)}
          </div>
        ))}

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setMode("personal_editing")}
            className="py-2.5 rounded-xl border border-primary/30 bg-card text-primary text-xs font-medium hover:bg-primary-soft transition flex items-center justify-center gap-1.5"
          >
            <Pencil className="h-3.5 w-3.5" /> 修订
          </button>
          <button
            disabled={submitting}
            onClick={() => setPreviewOpen(true)}
            className="py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium shadow-sm hover:bg-primary/90 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            确认
          </button>
        </div>
        {emailDraft && (
          <FeedbackEmailDialog
            draft={emailDraft}
            subName={CURRENT_USER.name}
            sending={false}
            onChange={setEmailDraft}
            onClose={() => setEmailDraft(null)}
            onConfirm={confirmEmailSend}
          />
        )}
        {previewOpen && report && (
          <GeneratedContentPreviewDialog
            title="确认4月绩效汇报"
            subtitle="请确认汇报正文和核心 KPI/关键工作进展，确认后再录入系统。"
            content={getPersonalReportPreviewText(report)}
            score={report.score}
            sending={submitting}
            onBack={() => setPreviewOpen(false)}
            onSubmitSystem={async () => {
              const ok = await submitToSystem();
              if (ok) setPreviewOpen(false);
            }}
            onSubmitEmail={async () => {
              setPreviewOpen(false);
              await submitAndOpenEmail();
            }}
          />
        )}
      </>
    );
  }

  // personal_editing
  if (!report) return null;
  return (
    <PersonalEditCard
      report={report}
      notes={notes}
      scores={scores}
      onNotesChange={setNotes}
      onScoresChange={setScores}
      onClose={() => setMode("personal_generated")}
      onSave={(r, nextNotes, nextScores) => {
        setNotes(nextNotes);
        setScores(nextScores);
        setReport(r);
        setMode("personal_generated");
        toast.success("已保存修改");
      }}
      submitting={submitting}
    />
  );
}

function PersonalEditCard({
  report, notes, scores, onNotesChange, onScoresChange, onClose, onSave, submitting,
}: {
  report: PersonalReport;
  notes: Record<string, string>;
  scores: Record<string, number | undefined>;
  onNotesChange: (notes: Record<string, string>) => void;
  onScoresChange: (scores: Record<string, number | undefined>) => void;
  onClose: () => void;
  onSave: (r: PersonalReport, notes: Record<string, string>, scores: Record<string, number | undefined>) => void;
  submitting: boolean;
}) {
  const [summary, setSummary] = useState(report.summary);
  const [localNotes, setLocalNotes] = useState(notes);
  const [localScores, setLocalScores] = useState(scores);
  const fieldCls =
    "w-full text-xs rounded-lg border border-border bg-primary-soft/25 p-3 leading-relaxed resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition";

  const buildCurrentReport = () => {
    const nextReport = buildPersonalReport(localNotes, localScores);
    return { ...nextReport, summary, optimized: report.optimized };
  };

  const save = () => {
    const nextReport = buildCurrentReport();
    onNotesChange(localNotes);
    onScoresChange(localScores);
    onSave(nextReport, localNotes, localScores);
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-start justify-center bg-slate-950/20 px-4 pt-16">
      <section className="flex max-h-[86vh] w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-border bg-white shadow-[0_28px_90px_rgba(15,23,42,0.2)]">
        <div className="flex items-center justify-between border-b border-border bg-primary-soft/45 px-5 py-4">
          <div className="flex items-center gap-2">
            <span className="h-4 w-1 rounded-full bg-primary" />
            <p className="font-semibold text-sm">修订个人月度汇报</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-secondary transition">
            <X className="h-4 w-4 text-muted-foreground" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-5 space-y-4">
          <label className="block">
            <span className="text-xs font-semibold text-muted-foreground">综合汇报</span>
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={5} className={`${fieldCls} mt-2`} />
          </label>

          <div className="space-y-3">
            <p className="text-xs font-semibold text-muted-foreground">核心 KPI 与关键工作自评</p>
            {PERSONAL_ITEMS.map((item) => {
              const tagCls = item.tag === "核心KPI"
                ? "bg-primary-soft text-accent-foreground"
                : "bg-success-soft text-success";
              return (
                <div key={item.id} className="rounded-2xl border border-border bg-white p-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${tagCls}`}>{item.tag}</span>
                    <span className="text-xs font-semibold flex-1 truncate">{item.title}</span>
                    {item.weight && <span className="text-[10px] text-muted-foreground">{item.weight}</span>}
                  </div>
                  <p className="mt-2 text-[11px] text-muted-foreground">目标：{item.goal}</p>
                  <div className="mt-2 grid gap-3 md:grid-cols-[minmax(0,1fr)_88px]">
                    <textarea
                      value={localNotes[item.id] ?? item.aiNote}
                      onChange={(e) => setLocalNotes({ ...localNotes, [item.id]: e.target.value })}
                      rows={3}
                      className={fieldCls}
                    />
                    <label className="block">
                      <span className="text-[11px] font-semibold text-muted-foreground">自评分</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={localScores[item.id] ?? ""}
                        onChange={(e) => {
                          const value = normalizeScore(e.target.value);
                          setLocalScores({ ...localScores, [item.id]: value ?? undefined });
                        }}
                        className="mt-2 h-9 w-full rounded-lg border border-border bg-white text-center text-sm font-bold text-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 border-t border-border bg-secondary/20 p-4">
          <button
            onClick={onClose}
            disabled={submitting}
            className="py-2 rounded-lg border border-primary/30 bg-card text-primary text-xs font-medium hover:bg-primary-soft transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={save}
            disabled={submitting}
            className="py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium shadow-sm hover:bg-primary/90 transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            保存修改
          </button>
        </div>
      </section>
    </div>,
    document.body,
  );
}

type RemindEntry = {
  id: string;
  name: string;
  initial: string;
  title: string;
  sentAt: string;
  status: "success" | "failed";
};

function formatTime(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function RemindPopover({
  targets,
  cooldowns,
  onConfirm,
  onLocate,
  triggerSize = "default",
}: {
  targets: Subordinate[];
  cooldowns: Record<string, number>;
  onConfirm: (ids: string[]) => void;
  onLocate?: (sub: Subordinate) => void;
  triggerSize?: "default" | "compact";
}) {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [entries, setEntries] = useState<RemindEntry[] | null>(null);
  const availableTargets = targets.filter((t) => (cooldowns[t.id] ?? 0) <= 0);
  const cooldownTargets = targets.filter((t) => (cooldowns[t.id] ?? 0) > 0);
  const canSend = availableTargets.length > 0;
  const formatCooldown = (ms: number) => `${Math.ceil(ms / 60000)} 分钟后可再次发送`;

  const sendTo = async (list: Subordinate[]) => {
    if (list.length === 0) return;
    setSending(true);
    await new Promise((r) => setTimeout(r, 700));
    const now = new Date();
    const result: RemindEntry[] = list.map((t) => ({
      id: t.id,
      name: t.name,
      initial: t.initial,
      title: t.title,
      sentAt: formatTime(now),
      status: "success",
    }));
    onConfirm(list.map((t) => t.id));
    setEntries(result);
    setSending(false);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setEntries(null);
          setSending(false);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button className={`rounded-lg bg-warning text-white text-xs font-bold hover:opacity-90 transition flex items-center gap-1.5 shrink-0 ${
          triggerSize === "compact" ? "px-2 py-1" : "px-3 py-1.5"
        }`}>
          <Bell className="h-3 w-3" /> 一键催办
        </button>
      </PopoverTrigger>
      <PopoverContent align="center" sideOffset={10} className="w-80 p-4">
        {entries ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-success">
              <Check className="h-4 w-4" />
              <p className="text-sm font-semibold">催办邮件发送成功</p>
            </div>
            <p className="text-[11px] text-muted-foreground">
              共 <b className="text-foreground">{entries.length}</b> 人 · 5 分钟后可再次发送
            </p>
            <ul className="max-h-56 overflow-auto divide-y divide-border border border-border rounded-lg bg-secondary/40">
              {entries.map((e) => (
                <li key={e.id} className="flex items-center gap-2 px-2.5 py-2">
                  <Avatar initial={e.initial} size="sm" src={getPersonAvatarUrl(e.id, e.name)} alt={e.name} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium truncate">{e.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">发送时间：{e.sentAt}</p>
                  </div>
                  <span
                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded shrink-0 ${
                      e.status === "success"
                        ? "bg-success-soft text-success"
                        : "bg-warning-soft text-warning"
                    }`}
                  >
                    {e.status === "success" ? "已送达" : "失败"}
                  </span>
                </li>
              ))}
            </ul>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 py-2 rounded-lg border border-primary/30 bg-card text-primary text-xs font-medium hover:bg-primary-soft transition"
              >
                完成
              </button>
              <button
                onClick={() => sendTo(availableTargets)}
                disabled={sending || !canSend}
                className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                {sending ? "发送中..." : canSend ? `重新发送（${availableTargets.length}）` : "冷却中"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold">催办名单</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                共 {targets.length} 人未提交本月汇报
                {cooldownTargets.length > 0
                  ? `，${cooldownTargets.length} 人仍在 5 分钟冷却期内。`
                  : "，确认后将发送催办邮件。"}
              </p>
            </div>
            <ul className="max-h-44 overflow-auto space-y-1.5 border border-border rounded-lg p-2 bg-secondary/40">
              {targets.map((t) => {
                const cooldownMs = cooldowns[t.id] ?? 0;
                return (
                  <li key={t.id} className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        onLocate?.(t);
                        setOpen(false);
                      }}
                      className="flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1.5 py-1 text-left transition hover:bg-white"
                    >
                      <Avatar initial={t.initial} size="sm" src={getPersonAvatarUrl(t.id, t.name)} alt={t.name} />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{t.name}</p>
                        <p className="text-[11px] text-muted-foreground truncate">{t.title}</p>
                      </div>
                    </button>
                    {cooldownMs > 0 ? (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-muted text-muted-foreground shrink-0">
                        {formatCooldown(cooldownMs)}
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-warning-soft text-warning shrink-0">
                        可催办
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setOpen(false)}
                className="flex-1 py-2 rounded-lg border border-primary/30 bg-card text-primary text-xs font-medium hover:bg-primary-soft transition"
              >
                取消
              </button>
              <button
                onClick={() => sendTo(availableTargets)}
                disabled={sending || !canSend}
                className="flex-1 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                {sending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Mail className="h-3 w-3" />}
                {sending ? "发送中..." : canSend ? `确认发送（${availableTargets.length}）` : "冷却中"}
              </button>
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
