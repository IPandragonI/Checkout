import { Suspense } from "react";
import { RoomClient } from "./RoomClient";

export default function RoomPage({ params }: PageProps<"/room/[code]">) {
  return (
    <Suspense fallback={<span className="loading loading-dots m-auto" />}>
      <Room params={params} />
    </Suspense>
  );
}

async function Room({ params }: { params: PageProps<"/room/[code]">["params"] }) {
  const { code } = await params;
  return <RoomClient code={code.toUpperCase()} />;
}
