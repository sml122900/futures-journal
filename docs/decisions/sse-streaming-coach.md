# 기술 결정: AI 코치 채팅 SSE 스트리밍

**날짜**: 2026-05-11

---

## 배경

AI 코치 채팅 API 초기 구현은 Claude API 호출 후 완성된 응답을 한 번에 반환하는 방식이었음.
응답 길이에 따라 3~10초 블로킹 대기가 발생해 UX가 나쁨.

---

## 결정: SSE(Server-Sent Events) + Anthropic SDK stream API

### 구현 방식

```typescript
// 서버: ReadableStream으로 SSE 전송
const stream = new ReadableStream({
  async start(controller) {
    const anthropicStream = await client.messages.stream({ ... });
    for await (const chunk of anthropicStream) {
      if (chunk.type === "content_block_delta") {
        controller.enqueue(encoder.encode(
          `data: ${JSON.stringify({ text: chunk.delta.text })}\n\n`
        ));
      }
    }
    // 완료 후 DB 저장 + 크레딧 차감
    await prisma.$transaction([...]);
    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true })}\n\n`));
  }
});
return new NextResponse(stream, { headers: { "Content-Type": "text/event-stream" } });

// 클라이언트: fetch + getReader()
const reader = res.body!.getReader();
while (true) {
  const { done, value } = await reader.read();
  // SSE 파싱 → accumulated += text → setState 업데이트
}
```

### 선택한 이유

1. **UX**: 첫 글자가 즉시 표시 → 사용자가 응답 생성 중임을 인지
2. **Next.js 호환**: `ReadableStream`은 App Router API Route에서 기본 지원
3. **크레딧 안전성**: 스트리밍 완료(done) 이후 트랜잭션 처리 → 중간 실패 시 차감 없음

### 포기한 대안

- **WebSocket**: 연결 관리 복잡, Next.js 서버리스와 궁합 나쁨
- **Long Polling**: 구현 단순하나 여전히 블로킹

### 주의사항

- `AICoachWidget`(인라인 모달)도 동일 SSE API 사용
- 스트리밍 중 에러 발생 시 `data: {"error": "..."}` 이벤트로 클라이언트에 전파
- conversationId를 `widget` 고정으로 분리해 풀페이지 대화와 독립
