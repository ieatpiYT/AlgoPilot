import { handleFo } from '@/lib/fo/server';
async function handler(request: Request, context: { params: Promise<{ action: string }> }) {
  return handleFo(request, (await context.params).action);
}
export { handler as GET, handler as POST };
