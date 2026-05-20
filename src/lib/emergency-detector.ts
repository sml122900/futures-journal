// 이 파일은 trigger-checker.ts로 교체되었습니다.
// 하위 호환을 위해 re-export만 유지.
export type { TriggerDecision as EmergencyDecision } from "@/lib/trigger-checker";
export { checkAllTriggers as detectEmergency } from "@/lib/trigger-checker";
