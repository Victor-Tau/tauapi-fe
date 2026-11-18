import { cn } from "cn"

// Brand marks from @lobehub/icons-static-svg (MIT). Mono marks use
// `currentColor` and follow the text colour (dark mode included); the
// "-color" variants carry the brand palette. Only the files listed here are
// bundled.
import alibaba from "@lobehub/icons-static-svg/icons/alibaba-color.svg?raw"
import baichuan from "@lobehub/icons-static-svg/icons/baichuan-color.svg?raw"
import claude from "@lobehub/icons-static-svg/icons/claude-color.svg?raw"
import cohere from "@lobehub/icons-static-svg/icons/cohere-color.svg?raw"
import deepseek from "@lobehub/icons-static-svg/icons/deepseek-color.svg?raw"
import doubao from "@lobehub/icons-static-svg/icons/doubao-color.svg?raw"
import flux from "@lobehub/icons-static-svg/icons/flux.svg?raw"
import gemini from "@lobehub/icons-static-svg/icons/gemini-color.svg?raw"
import gemma from "@lobehub/icons-static-svg/icons/gemma-color.svg?raw"
import grok from "@lobehub/icons-static-svg/icons/grok.svg?raw"
import hunyuan from "@lobehub/icons-static-svg/icons/hunyuan-color.svg?raw"
import jina from "@lobehub/icons-static-svg/icons/jina.svg?raw"
import kimi from "@lobehub/icons-static-svg/icons/kimi-color.svg?raw"
import meta from "@lobehub/icons-static-svg/icons/meta-color.svg?raw"
import microsoft from "@lobehub/icons-static-svg/icons/microsoft-color.svg?raw"
import midjourney from "@lobehub/icons-static-svg/icons/midjourney.svg?raw"
import minimax from "@lobehub/icons-static-svg/icons/minimax-color.svg?raw"
import mistral from "@lobehub/icons-static-svg/icons/mistral-color.svg?raw"
import moonshot from "@lobehub/icons-static-svg/icons/moonshot.svg?raw"
import nvidia from "@lobehub/icons-static-svg/icons/nvidia-color.svg?raw"
import openai from "@lobehub/icons-static-svg/icons/openai.svg?raw"
import perplexity from "@lobehub/icons-static-svg/icons/perplexity-color.svg?raw"
import qwen from "@lobehub/icons-static-svg/icons/qwen-color.svg?raw"
import spark from "@lobehub/icons-static-svg/icons/spark-color.svg?raw"
import stability from "@lobehub/icons-static-svg/icons/stability-color.svg?raw"
import stepfun from "@lobehub/icons-static-svg/icons/stepfun-color.svg?raw"
import suno from "@lobehub/icons-static-svg/icons/suno.svg?raw"
import wenxin from "@lobehub/icons-static-svg/icons/wenxin-color.svg?raw"
import yi from "@lobehub/icons-static-svg/icons/yi-color.svg?raw"
import zai from "@lobehub/icons-static-svg/icons/zai.svg?raw"
import zhipu from "@lobehub/icons-static-svg/icons/zhipu-color.svg?raw"

interface Vendor {
  name: string
  svg: string
  /** Tested against the lower-cased model name; first match wins. */
  pattern?: RegExp
  /**
   * Normalized names a catalog vendor may use for this brand: its lobehub
   * icon key ("DeepSeek.Color" → "deepseek") or display name.
   */
  aliases?: string[]
}

// Order matters: specific families come before broader ones (e.g. Gemma
// before Gemini/Google, Kimi before Moonshot).
const VENDORS: Vendor[] = [
  {
    name: "Claude",
    svg: claude,
    pattern: /claude/,
    aliases: ["anthropic"],
  },
  { name: "Gemma", svg: gemma, pattern: /gemma/ },
  {
    name: "Gemini",
    svg: gemini,
    pattern: /gemini|imagen|veo-/,
    aliases: ["google", "谷歌"],
  },
  { name: "DeepSeek", svg: deepseek, pattern: /deepseek/ },
  {
    name: "Qwen",
    svg: qwen,
    pattern: /qwen|qwq|qvq|wanx|wan2/,
    aliases: ["千问", "通义千问"],
  },
  { name: "Grok", svg: grok, pattern: /grok/, aliases: ["xai"] },
  { name: "Meta", svg: meta, pattern: /llama|meta-/ },
  {
    name: "Mistral",
    svg: mistral,
    pattern: /mistral|mixtral|codestral|pixtral|magistral|devstral|ministral/,
  },
  // Catalog-only: chosen when the server files a model under Z.ai.
  { name: "Z.ai", svg: zai, aliases: ["zai", "z.ai"] },
  {
    name: "智谱",
    svg: zhipu,
    pattern: /glm|cogview|cogvideo|zhipu/,
    aliases: ["chatglm", "zhipuai"],
  },
  { name: "Kimi", svg: kimi, pattern: /kimi/ },
  {
    name: "Moonshot",
    svg: moonshot,
    pattern: /moonshot/,
    aliases: ["月之暗面"],
  },
  {
    name: "豆包",
    svg: doubao,
    pattern: /doubao|seedream|seedance/,
    aliases: ["bytedance", "字节跳动", "火山引擎", "volcengine"],
  },
  { name: "MiniMax", svg: minimax, pattern: /minimax|abab/ },
  {
    name: "混元",
    svg: hunyuan,
    pattern: /hunyuan/,
    aliases: ["腾讯", "tencent"],
  },
  {
    name: "文心",
    svg: wenxin,
    pattern: /ernie|wenxin/,
    aliases: ["百度", "baidu", "ernie"],
  },
  { name: "零一万物", svg: yi, pattern: /^yi-|\/yi-/, aliases: ["yi", "01ai"] },
  { name: "Cohere", svg: cohere, pattern: /command|cohere|^embed-|rerank-/ },
  { name: "Midjourney", svg: midjourney, pattern: /^mj_|midjourney/ },
  { name: "Suno", svg: suno, pattern: /suno|chirp/ },
  { name: "Flux", svg: flux, pattern: /flux/ },
  {
    name: "Stability",
    svg: stability,
    pattern: /stable-diffusion|sdxl|sd3|stability/,
  },
  {
    name: "讯飞星火",
    svg: spark,
    pattern: /spark/,
    aliases: ["讯飞", "iflytek"],
  },
  { name: "阶跃星辰", svg: stepfun, pattern: /^step-|stepfun/ },
  { name: "Jina", svg: jina, pattern: /jina/ },
  { name: "百川", svg: baichuan, pattern: /baichuan/ },
  { name: "Perplexity", svg: perplexity, pattern: /perplexity|sonar/ },
  { name: "NVIDIA", svg: nvidia, pattern: /nvidia|nemotron/ },
  { name: "Microsoft", svg: microsoft, pattern: /^phi-|\/phi-/ },
  {
    name: "通义",
    svg: alibaba,
    pattern: /tongyi|aliyun/,
    aliases: ["阿里", "阿里云", "阿里巴巴", "alibabacloud"],
  },
  {
    name: "OpenAI",
    svg: openai,
    pattern:
      /gpt|chatgpt|^o\d|\/o\d|dall-e|whisper|^tts-|text-embedding|davinci|babbage|codex|sora|omni-moderation/,
  },
]

const cache = new Map<string, Vendor | null>()

/** The vendor behind a model name, or null when it is not recognised. */
export function modelVendor(model: string | undefined): Vendor | null {
  if (!model) return null
  const key = model.toLowerCase()
  let vendor = cache.get(key)
  if (vendor === undefined) {
    vendor = VENDORS.find((item) => item.pattern?.test(key)) ?? null
    cache.set(key, vendor)
  }
  return vendor
}

/** "DeepSeek.Color" / "Deep Seek" → "deepseek". */
function normalizeBrand(value: string): string {
  return value
    .toLowerCase()
    .replace(/\.(color|text|avatar|brand|combine)$/, "")
    .replace(/[\s_-]+/g, "")
}

/** A catalog vendor ({ name, icon }) mapped to a bundled logo. */
function catalogVendor(vendor: CatalogVendor | undefined): Vendor | null {
  if (!vendor) return null
  const keys = [vendor.icon, vendor.name]
    .filter((value): value is string => Boolean(value))
    .map(normalizeBrand)
  return (
    VENDORS.find((item) =>
      keys.some(
        (key) =>
          key === normalizeBrand(item.name) || item.aliases?.includes(key)
      )
    ) ?? null
  )
}

/** The `vendors[]` entry from `/api/pricing`. */
export interface CatalogVendor {
  name: string
  icon?: string
}

/** Brand shown by `ModelIcon` for these inputs, or null when unknown. */
export function modelBrand(
  model: string | undefined,
  vendor?: CatalogVendor
): string | null {
  return (catalogVendor(vendor) ?? modelVendor(model))?.name ?? null
}

/** True when `ModelIcon` would render a logo for these inputs. */
export function hasModelIcon(
  model: string | undefined,
  vendor?: CatalogVendor
): boolean {
  return (catalogVendor(vendor) ?? modelVendor(model)) !== null
}

/**
 * Vendor logo for a model; renders nothing when neither the catalog vendor
 * nor the model name is recognised. The catalog vendor wins when given. The
 * SVGs are bundled static assets (not user data), so inlining them is safe.
 */
export function ModelIcon({
  model,
  vendor: catalog,
  className,
}: {
  model: string | undefined
  vendor?: CatalogVendor
  className?: string
}) {
  const vendor = catalogVendor(catalog) ?? modelVendor(model)
  if (!vendor) return null
  return (
    <span
      role="img"
      aria-label={vendor.name}
      title={vendor.name}
      className={cn(
        "inline-flex size-4 shrink-0 items-center justify-center text-base leading-none [&>svg]:size-full",
        className
      )}
      dangerouslySetInnerHTML={{ __html: vendor.svg }}
    />
  )
}
