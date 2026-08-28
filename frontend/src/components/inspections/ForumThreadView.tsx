"use client"

import { useEffect, useState, useCallback } from "react"
import { useTranslations } from "next-intl"
import { toast } from "sonner"
import { Loader2, Send, User } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { getThread, addPost, type ForumThreadDetail } from "@/lib/api/inspector-community"

export function ForumThreadView({ threadId }: { threadId: string }) {
  const t = useTranslations("inspections.community")
  const [thread, setThread] = useState<ForumThreadDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [replyBody, setReplyBody] = useState("")
  const [posting, setPosting] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    getThread(threadId).then((res) => {
      if (res.error) toast.error(res.error)
      setThread(res.data)
      setLoading(false)
    })
  }, [threadId])

  useEffect(() => { load() }, [load])

  const handleReply = async () => {
    if (!replyBody.trim()) return
    setPosting(true)
    try {
      const res = await addPost(threadId, replyBody.trim())
      if (res.error) toast.error(res.error)
      else { setReplyBody(""); load() }
    } finally {
      setPosting(false)
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
  }
  if (!thread) {
    return <div className="p-6 text-center text-gray-500">{t("thread_not_found")}</div>
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2 flex-wrap">
            <CardTitle className="text-lg">{thread.title}</CardTitle>
            {thread.subject && <Badge variant="outline">{thread.subject.name}</Badge>}
          </div>
        </CardHeader>
      </Card>

      <div className="space-y-3">
        {thread.posts.map((post) => (
          <Card key={post.id}>
            <CardContent className="py-3">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="h-7 w-7 rounded-full bg-[#022172]/10 flex items-center justify-center shrink-0">
                  <User className="h-3.5 w-3.5 text-[#022172]" />
                </div>
                <span className="text-sm font-medium text-gray-900">
                  {post.author ? `${post.author.first_name} ${post.author.last_name}` : ""}
                </span>
                {post.author?.role === "inspector" && <Badge variant="secondary" className="text-[10px]">{t("inspector_badge")}</Badge>}
                <span className="text-xs text-gray-400 ml-auto">{new Date(post.created_at).toLocaleString()}</span>
              </div>
              <p className="text-sm text-gray-800 whitespace-pre-wrap">{post.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="py-3 space-y-2">
          <Textarea rows={3} value={replyBody} onChange={(e) => setReplyBody(e.target.value)} placeholder={t("field_reply_placeholder")} />
          <div className="flex justify-end">
            <Button size="sm" onClick={handleReply} disabled={posting || !replyBody.trim()} className="gap-2">
              {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              {t("btn_reply")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
