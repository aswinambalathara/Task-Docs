import { PageLoader } from "@/components/layout/page-loader"

// Streamed right away while a route's server work (e.g. the auth check on "/") finishes
export default function Loading() {
  return <PageLoader />
}
