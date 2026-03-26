var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
var CHUNK_SIZE = 64 * 1024 * 1024;
var MIN_RESUMABLE_CHUNK_SIZE = 256 * 1024;
var PROGRESS_UPDATE_INTERVAL = 50 * 1024 * 1024;
var MAX_CHUNK_SIZE = 256 * 1024 * 1024;
var TARGET_MAX_CHUNKS = 40;
var HARD_MAX_CHUNKS = 45;
function sanitizeVideoTitle(input) {
  return input.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/[\u200B-\u200D\uFEFF]/g, "").replace(/\s+/g, " ").trim();
}
__name(sanitizeVideoTitle, "sanitizeVideoTitle");
async function fetchWithRetry(url, attempts = 2) {
  let lastError = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetch(url, {
        method: "GET",
        redirect: "follow"
      });
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Network connection lost");
}
__name(fetchWithRetry, "fetchWithRetry");
var src_default = {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    if (request.method !== "POST" && request.method !== "GET") {
      return new Response("Method not allowed", { status: 405 });
    }
    const url = new URL(request.url);
    if (url.pathname === "/upload-video") {
      return handleVideoUpload(request, env, corsHeaders);
    }
    if (url.pathname === "/upload-thumbnail") {
      return handleThumbnailUpload(request, env, corsHeaders);
    }
    if (url.pathname === "/upload-progress") {
      return handleProgress(request, env, corsHeaders);
    }
    if (url.pathname === "/remote-upload") {
      return handleRemoteUpload(request, env, corsHeaders);
    }
    return new Response("Not found", { status: 404 });
  }
};
async function handleVideoUpload(request, env, corsHeaders) {
  let currentStage = "init";
  try {
    const contentType = request.headers.get("content-type") || "";
    let uploadData;
    let videoStream;
    let videoSize = 0;
    let subtitleBlob = null;
    if (contentType.includes("multipart/form-data")) {
      currentStage = "parse_multipart_form";
      const formData = await request.formData();
      const videoFile = formData.get("video");
      const title = formData.get("title");
      const description = formData.get("description");
      const privacyStatus = formData.get("privacyStatus");
      const playlistId = formData.get("playlistId");
      const defaultLanguage = formData.get("defaultLanguage");
      const defaultAudioLanguage = formData.get("defaultAudioLanguage");
      const subtitle = formData.get("subtitle");
      const subtitleLanguage = formData.get("subtitleLanguage");
      const subtitleName = formData.get("subtitleName");
      const accessToken = formData.get("accessToken");
      if (!title || typeof title !== "string") {
        return new Response(
          JSON.stringify({ error: "Missing title" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const cleanedTitle = sanitizeVideoTitle(title);
      if (!cleanedTitle) {
        return new Response(
          JSON.stringify({ error: "Video title tidak boleh kosong" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (cleanedTitle.length > 100) {
        return new Response(
          JSON.stringify({
            error: "Video title terlalu panjang (maksimal 100 karakter)",
            debug: { titleLength: cleanedTitle.length }
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!accessToken || typeof accessToken !== "string") {
        return new Response(
          JSON.stringify({ error: "Missing access token" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (!videoFile) {
        return new Response(
          JSON.stringify({ error: "Missing video file" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (typeof videoFile === "string") {
        return new Response(
          JSON.stringify({ error: "Invalid video file" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const video = videoFile;
      videoStream = video.stream();
      videoSize = video.size;
      uploadData = {
        title: cleanedTitle,
        description: typeof description === "string" ? description : void 0,
        privacyStatus: typeof privacyStatus === "string" ? privacyStatus : "private",
        playlistId: typeof playlistId === "string" ? playlistId : void 0,
        defaultLanguage: typeof defaultLanguage === "string" ? defaultLanguage : "id",
        defaultAudioLanguage: typeof defaultAudioLanguage === "string" ? defaultAudioLanguage : "id",
        subtitleLanguage: typeof subtitleLanguage === "string" ? subtitleLanguage : "id",
        subtitleName: typeof subtitleName === "string" ? subtitleName : "Subtitle Indonesia",
        videoSource: "local",
        accessToken
      };
      if (subtitle && typeof subtitle !== "string") {
        subtitleBlob = subtitle;
      }
    } else {
      currentStage = "parse_json_payload";
      uploadData = await request.json();
      if (!uploadData.videoUrl || !uploadData.title || !uploadData.accessToken) {
        return new Response(
          JSON.stringify({ error: "Missing required fields" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const cleanedTitle = sanitizeVideoTitle(uploadData.title);
      if (!cleanedTitle) {
        return new Response(
          JSON.stringify({ error: "Video title tidak boleh kosong" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (cleanedTitle.length > 100) {
        return new Response(
          JSON.stringify({
            error: "Video title terlalu panjang (maksimal 100 karakter)",
            debug: { titleLength: cleanedTitle.length }
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      uploadData.title = cleanedTitle;
      currentStage = "fetch_video_from_onedrive";
      const videoResponse = await fetchWithRetry(uploadData.videoUrl, 2);
      if (!videoResponse.ok) {
        const errorBody = await videoResponse.text();
        return new Response(
          JSON.stringify({
            error: "Failed to fetch video from OneDrive",
            debug: {
              stage: currentStage,
              status: videoResponse.status,
              statusText: videoResponse.statusText,
              responseBodyPreview: errorBody.slice(0, 400)
            }
          }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      videoStream = videoResponse.body;
      videoSize = parseInt(videoResponse.headers.get("content-length") || "0");
    }
    const uploadId = crypto.randomUUID();
    let videoId = "";
    if (uploadData.videoSource === "onedrive") {
      const maxSingleStreamAttempts = 2;
      let lastUploadError = null;
      for (let attempt = 1; attempt <= maxSingleStreamAttempts; attempt++) {
        const attemptLabel = `attempt_${attempt}`;
        try {
          let attemptVideoStream = videoStream;
          let attemptVideoSize = videoSize;
          if (attempt > 1) {
            const refreshedVideo = await getOneDriveVideoStream(uploadData.videoUrl);
            attemptVideoStream = refreshedVideo.stream;
            attemptVideoSize = refreshedVideo.size || videoSize;
          }
          currentStage = `init_resumable_upload_${attemptLabel}`;
          const uploadUrl = await initYouTubeResumableUpload(uploadData, attemptVideoSize);
          currentStage = `upload_single_stream_video_${attemptLabel}`;
          videoId = await uploadVideoSingleStream(
            attemptVideoStream,
            uploadUrl,
            attemptVideoSize,
            uploadId,
            env
          );
          lastUploadError = null;
          break;
        } catch (error) {
          lastUploadError = error;
          console.error(`OneDrive single-stream ${attemptLabel} failed:`, error);
        }
      }
      if (!videoId) {
        currentStage = "prepare_chunked_fallback_after_single_stream";
        const fallbackVideo = await getOneDriveVideoStream(uploadData.videoUrl);
        const fallbackVideoSize = fallbackVideo.size || videoSize;
        const chunkPlan = getChunkPlanForWorkerLimit(fallbackVideoSize);
        if (!chunkPlan.feasible) {
          throw new Error(
            `Video terlalu besar untuk diproses stabil via Worker (perkiraan ${chunkPlan.estimatedChunks} chunk). Silakan kecilkan ukuran video atau upload lokal.`
          );
        }
        currentStage = "init_resumable_upload_chunked_fallback";
        const chunkedUploadUrl = await initYouTubeResumableUpload(uploadData, fallbackVideoSize);
        currentStage = "upload_chunked_video_fallback_controlled";
        videoId = await uploadVideoChunked(
          fallbackVideo.stream,
          chunkedUploadUrl,
          fallbackVideoSize,
          uploadId,
          env,
          {
            disableProgress: true,
            chunkSize: chunkPlan.chunkSize,
            maxChunks: HARD_MAX_CHUNKS
          }
        );
      }
    } else {
      currentStage = "init_resumable_upload";
      const uploadUrl = await initYouTubeResumableUpload(uploadData, videoSize);
      currentStage = "upload_chunked_video";
      videoId = await uploadVideoChunked(
        videoStream,
        uploadUrl,
        videoSize,
        uploadId,
        env
      );
    }
    if (uploadData.thumbnailUrl && videoId) {
      currentStage = "upload_thumbnail";
      await uploadThumbnailFromUrl(
        videoId,
        uploadData.thumbnailUrl,
        uploadData.accessToken
      );
    }
    if (uploadData.playlistId && videoId) {
      currentStage = "add_video_to_playlist";
      await addVideoToPlaylist(videoId, uploadData.playlistId, uploadData.accessToken);
    }
    if (videoId) {
      if (subtitleBlob) {
        currentStage = "upload_subtitle_blob";
        await uploadSubtitleFromBlob(
          videoId,
          subtitleBlob,
          uploadData.accessToken,
          uploadData.subtitleLanguage || uploadData.defaultLanguage || "id",
          uploadData.subtitleName || "Subtitle Indonesia"
        );
      } else if (uploadData.subtitleUrl) {
        currentStage = "upload_subtitle_url";
        await uploadSubtitleFromUrl(
          videoId,
          uploadData.subtitleUrl,
          uploadData.accessToken,
          uploadData.subtitleLanguage || uploadData.defaultLanguage || "id",
          uploadData.subtitleName || "Subtitle Indonesia"
        );
      }
    }
    return new Response(
      JSON.stringify({
        success: true,
        videoId,
        uploadId,
        url: `https://www.youtube.com/watch?v=${videoId}`
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Upload error:", error);
    return new Response(
      JSON.stringify({
        error: error.message,
        debug: {
          stage: currentStage
        }
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
__name(handleVideoUpload, "handleVideoUpload");
async function initYouTubeResumableUpload(uploadData, videoSize) {
  const initResponse = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${uploadData.accessToken}`,
        "Content-Type": "application/json",
        "X-Upload-Content-Length": videoSize.toString(),
        "X-Upload-Content-Type": "video/*"
      },
      body: JSON.stringify({
        snippet: {
          title: uploadData.title,
          description: uploadData.description || "",
          categoryId: uploadData.categoryId || "22",
          defaultLanguage: uploadData.defaultLanguage || "id",
          defaultAudioLanguage: uploadData.defaultAudioLanguage || "id"
        },
        status: {
          privacyStatus: uploadData.privacyStatus || "private"
        }
      })
    }
  );
  if (!initResponse.ok) {
    const error = await initResponse.text();
    throw new Error(`YouTube init failed: ${error}`);
  }
  const uploadUrl = initResponse.headers.get("location");
  if (!uploadUrl) {
    throw new Error("No upload URL received");
  }
  return uploadUrl;
}
__name(initYouTubeResumableUpload, "initYouTubeResumableUpload");
async function getOneDriveVideoStream(videoUrl) {
  const response = await fetchWithRetry(videoUrl, 2);
  if (!response.ok || !response.body) {
    throw new Error("Failed to fetch fresh OneDrive stream");
  }
  const size = parseInt(response.headers.get("content-length") || "0");
  return {
    stream: response.body,
    size: Number.isFinite(size) ? size : 0
  };
}
__name(getOneDriveVideoStream, "getOneDriveVideoStream");
function getChunkPlanForWorkerLimit(totalSize) {
  if (!Number.isFinite(totalSize) || totalSize <= 0) {
    return {
      chunkSize: CHUNK_SIZE,
      estimatedChunks: 1,
      feasible: true
    };
  }
  const requiredPerChunk = Math.ceil(totalSize / TARGET_MAX_CHUNKS);
  const roundedRequired = Math.ceil(requiredPerChunk / MIN_RESUMABLE_CHUNK_SIZE) * MIN_RESUMABLE_CHUNK_SIZE;
  const chunkSize = Math.min(
    MAX_CHUNK_SIZE,
    Math.max(CHUNK_SIZE, roundedRequired)
  );
  const estimatedChunks = Math.ceil(totalSize / chunkSize);
  return {
    chunkSize,
    estimatedChunks,
    feasible: estimatedChunks <= HARD_MAX_CHUNKS
  };
}
__name(getChunkPlanForWorkerLimit, "getChunkPlanForWorkerLimit");
async function addVideoToPlaylist(videoId, playlistId, accessToken) {
  const response = await fetch(
    "https://www.googleapis.com/youtube/v3/playlistItems?part=snippet",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        snippet: {
          playlistId,
          resourceId: {
            kind: "youtube#video",
            videoId
          }
        }
      })
    }
  );
  if (!response.ok) {
    console.error("Failed to add video to playlist:", await response.text());
  }
}
__name(addVideoToPlaylist, "addVideoToPlaylist");
async function uploadSubtitleFromUrl(videoId, subtitleUrl, accessToken, language, subtitleName) {
  const subtitleResponse = await fetch(subtitleUrl);
  if (!subtitleResponse.ok) {
    console.error("Failed to fetch subtitle from URL");
    return;
  }
  const subtitleBlob = await subtitleResponse.blob();
  await uploadSubtitleFromBlob(videoId, subtitleBlob, accessToken, language, subtitleName);
}
__name(uploadSubtitleFromUrl, "uploadSubtitleFromUrl");
async function uploadSubtitleFromBlob(videoId, subtitleBlob, accessToken, language, subtitleName) {
  const response = await fetch(
    "https://www.googleapis.com/upload/youtube/v3/captions?part=snippet&sync=false",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": subtitleBlob.type || "application/octet-stream"
      },
      body: subtitleBlob
    }
  );
  if (!response.ok) {
    console.error("Failed to upload subtitle:", await response.text());
    return;
  }
  const captionData = await response.json();
  if (!captionData.id) {
    return;
  }
  const patchResponse = await fetch(
    "https://www.googleapis.com/youtube/v3/captions?part=snippet",
    {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        id: captionData.id,
        snippet: {
          videoId,
          language,
          name: subtitleName,
          isDraft: false
        }
      })
    }
  );
  if (!patchResponse.ok) {
    console.error("Failed to set subtitle metadata:", await patchResponse.text());
  }
}
__name(uploadSubtitleFromBlob, "uploadSubtitleFromBlob");
async function uploadVideoSingleStream(stream, uploadUrl, totalSize, uploadId, env) {
  const uploadResponse = await fetch(uploadUrl, {
    method: "PUT",
    headers: {
      "Content-Length": totalSize.toString(),
      "Content-Range": `bytes 0-${totalSize - 1}/${totalSize}`
    },
    body: stream,
    duplex: "half"
  });
  if (!uploadResponse.ok) {
    throw new Error(`Single stream upload failed: ${await uploadResponse.text()}`);
  }
  const result = await uploadResponse.json();
  if (!result.id) {
    throw new Error("Single stream upload completed but no video ID received");
  }
  await updateProgress(env, uploadId, totalSize, totalSize);
  return result.id;
}
__name(uploadVideoSingleStream, "uploadVideoSingleStream");
async function uploadVideoChunked(stream, uploadUrl, totalSize, uploadId, env, options) {
  if (!Number.isFinite(totalSize) || totalSize <= 0) {
    throw new Error("Ukuran video tidak valid untuk resumable upload");
  }
  const effectiveChunkSize = Math.max(
    MIN_RESUMABLE_CHUNK_SIZE,
    options?.chunkSize || CHUNK_SIZE
  );
  if (options?.maxChunks) {
    const estimatedChunks = Math.ceil(totalSize / effectiveChunkSize);
    if (estimatedChunks > options.maxChunks) {
      throw new Error(
        `Jumlah chunk terlalu banyak untuk limit Worker (${estimatedChunks} > ${options.maxChunks})`
      );
    }
  }
  const reader = stream.getReader();
  let uploadedBytes = 0;
  let buffer = [];
  let bufferSize = 0;
  let pendingChunk = null;
  let streamDone = false;
  let lastProgressUpdatedAt = 0;
  const concatUint8Arrays = /* @__PURE__ */ __name((a, b) => {
    const merged = new Uint8Array(a.length + b.length);
    merged.set(a, 0);
    merged.set(b, a.length);
    return merged;
  }, "concatUint8Arrays");
  const getAckedBytes = /* @__PURE__ */ __name((response) => {
    const rangeHeader = response.headers.get("Range") || response.headers.get("range");
    if (!rangeHeader) {
      return uploadedBytes;
    }
    const match = /bytes=0-(\d+)/.exec(rangeHeader);
    if (!match) {
      return uploadedBytes;
    }
    const acknowledgedEnd = parseInt(match[1], 10);
    if (!Number.isFinite(acknowledgedEnd) || acknowledgedEnd < 0) {
      return uploadedBytes;
    }
    return acknowledgedEnd + 1;
  }, "getAckedBytes");
  while (true) {
    if (!pendingChunk) {
      const { done, value } = await reader.read();
      streamDone = done;
      if (value) {
        buffer.push(value);
        bufferSize += value.length;
      }
      if (bufferSize >= effectiveChunkSize || done && bufferSize > 0) {
        const chunk = new Uint8Array(bufferSize);
        let offset = 0;
        for (const arr of buffer) {
          chunk.set(arr, offset);
          offset += arr.length;
        }
        pendingChunk = chunk;
        buffer = [];
        bufferSize = 0;
      }
      if (streamDone && !pendingChunk) {
        break;
      }
    }
    if (pendingChunk) {
      while (pendingChunk.length < MIN_RESUMABLE_CHUNK_SIZE && uploadedBytes + pendingChunk.length < totalSize && !streamDone) {
        const { done, value } = await reader.read();
        streamDone = done;
        if (value && value.length > 0) {
          pendingChunk = concatUint8Arrays(pendingChunk, value);
        }
        if (streamDone) {
          break;
        }
      }
      const chunk = pendingChunk;
      const chunkBuffer = chunk.buffer.slice(
        chunk.byteOffset,
        chunk.byteOffset + chunk.byteLength
      );
      const startByte = uploadedBytes;
      const endByte = uploadedBytes + chunk.length - 1;
      const uploadResponse = await fetch(uploadUrl, {
        method: "PUT",
        headers: {
          "Content-Length": chunk.length.toString(),
          "Content-Range": `bytes ${startByte}-${endByte}/${totalSize}`
        },
        body: chunkBuffer
      });
      if (!uploadResponse.ok && uploadResponse.status !== 308) {
        throw new Error(`Upload chunk failed: ${await uploadResponse.text()}`);
      }
      if (uploadResponse.status === 200 || uploadResponse.status === 201) {
        const result = await uploadResponse.json();
        return result.id;
      }
      const ackedBytes = getAckedBytes(uploadResponse);
      const acceptedInThisChunk = Math.max(0, Math.min(chunk.length, ackedBytes - startByte));
      if (acceptedInThisChunk >= chunk.length) {
        pendingChunk = null;
      } else if (acceptedInThisChunk > 0) {
        pendingChunk = chunk.slice(acceptedInThisChunk);
      }
      uploadedBytes = ackedBytes;
      if (!options?.disableProgress) {
        const shouldUpdateProgress = uploadedBytes === totalSize || uploadedBytes - lastProgressUpdatedAt >= PROGRESS_UPDATE_INTERVAL;
        if (shouldUpdateProgress) {
          await updateProgress(env, uploadId, uploadedBytes, totalSize);
          lastProgressUpdatedAt = uploadedBytes;
        }
      }
    }
  }
  throw new Error("Upload completed but no video ID received");
}
__name(uploadVideoChunked, "uploadVideoChunked");
async function uploadThumbnailFromUrl(videoId, thumbnailUrl, accessToken) {
  const thumbnailResponse = await fetch(thumbnailUrl);
  if (!thumbnailResponse.ok) {
    console.error("Failed to fetch thumbnail");
    return;
  }
  const thumbnailBlob = await thumbnailResponse.blob();
  await fetch(
    `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": thumbnailBlob.type
      },
      body: thumbnailBlob
    }
  );
}
__name(uploadThumbnailFromUrl, "uploadThumbnailFromUrl");
async function handleThumbnailUpload(request, env, corsHeaders) {
  try {
    const formData = await request.formData();
    const videoId = formData.get("videoId");
    const thumbnail = formData.get("thumbnail");
    const accessToken = formData.get("accessToken");
    if (!videoId || typeof videoId !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing video ID" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!accessToken || typeof accessToken !== "string") {
      return new Response(
        JSON.stringify({ error: "Missing access token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!thumbnail) {
      return new Response(
        JSON.stringify({ error: "Missing thumbnail" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (typeof thumbnail === "string") {
      return new Response(
        JSON.stringify({ error: "Invalid thumbnail file" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const thumbnailFile = thumbnail;
    const uploadResponse = await fetch(
      `https://www.googleapis.com/upload/youtube/v3/thumbnails/set?videoId=${videoId}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": thumbnailFile.type
        },
        body: thumbnailFile
      }
    );
    if (!uploadResponse.ok) {
      throw new Error("Thumbnail upload failed");
    }
    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
__name(handleThumbnailUpload, "handleThumbnailUpload");
async function handleProgress(request, env, corsHeaders) {
  const url = new URL(request.url);
  const uploadId = url.searchParams.get("uploadId");
  if (!uploadId) {
    return new Response(
      JSON.stringify({ error: "Missing uploadId" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
  const progress = await getProgress(env, uploadId);
  return new Response(JSON.stringify(progress), {
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}
__name(handleProgress, "handleProgress");
async function updateProgress(env, uploadId, uploaded, total) {
  const key = `upload:progress:${uploadId}`;
  const progress = {
    uploaded,
    total,
    percentage: Math.round(uploaded / total * 100),
    timestamp: Date.now()
  };
  const value = encodeURIComponent(JSON.stringify(progress));
  await fetch(`${env.UPSTASH_REDIS_REST_URL}/set/${key}/${value}`, {
    headers: {
      Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`
    }
  });
  await fetch(`${env.UPSTASH_REDIS_REST_URL}/expire/${key}/3600`, {
    headers: {
      Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`
    }
  });
}
__name(updateProgress, "updateProgress");
async function getProgress(env, uploadId) {
  const key = `upload:progress:${uploadId}`;
  const response = await fetch(`${env.UPSTASH_REDIS_REST_URL}/get/${key}`, {
    headers: {
      Authorization: `Bearer ${env.UPSTASH_REDIS_REST_TOKEN}`
    }
  });
  const data = await response.json();
  return data.result ? JSON.parse(data.result) : null;
}
__name(getProgress, "getProgress");
async function handleRemoteUpload(request, env, corsHeaders) {
  try {
    const { url, fileName, folder, oneDriveAccessToken } = await request.json();
    if (!url || !fileName || !oneDriveAccessToken) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6e4);
    try {
      const fileResponse = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      if (!fileResponse.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to download file from URL" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const fileStream = fileResponse.body;
      const fileSize = parseInt(fileResponse.headers.get("content-length") || "0");
      if (!fileStream) {
        return new Response(
          JSON.stringify({ error: "No file stream" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (fileSize > 250 * 1024 * 1024) {
        return new Response(
          JSON.stringify({ error: "File too large (max 250MB)" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const pathSegments = folder ? [folder, fileName] : [fileName];
      const encodedPath = pathSegments.map((s) => encodeURIComponent(s)).join("/");
      if (fileSize < 4 * 1024 * 1024) {
        const uploadResponse = await fetch(
          `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedPath}:/content`,
          {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${oneDriveAccessToken}`,
              "Content-Type": fileResponse.headers.get("content-type") || "application/octet-stream"
            },
            body: fileStream
          }
        );
        if (!uploadResponse.ok) {
          const error = await uploadResponse.text();
          return new Response(
            JSON.stringify({ error: `OneDrive upload failed: ${error}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const result = await uploadResponse.json();
        return new Response(
          JSON.stringify({
            success: true,
            file: {
              id: result.id,
              name: result.name,
              size: result.size,
              webUrl: result.webUrl
            }
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        const sessionResponse = await fetch(
          `https://graph.microsoft.com/v1.0/me/drive/root:/${encodedPath}:/createUploadSession`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${oneDriveAccessToken}`,
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              item: {
                "@microsoft.graph.conflictBehavior": "replace"
              }
            })
          }
        );
        if (!sessionResponse.ok) {
          return new Response(
            JSON.stringify({ error: "Failed to create upload session" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const session = await sessionResponse.json();
        const uploadUrl = session.uploadUrl;
        const reader = fileStream.getReader();
        let uploadedBytes = 0;
        let buffer = [];
        let bufferSize = 0;
        const chunkSize = 10 * 1024 * 1024;
        while (true) {
          const { done, value } = await reader.read();
          if (value) {
            buffer.push(value);
            bufferSize += value.length;
          }
          if (bufferSize >= chunkSize || done && bufferSize > 0) {
            const chunk = new Uint8Array(bufferSize);
            let offset = 0;
            for (const arr of buffer) {
              chunk.set(arr, offset);
              offset += arr.length;
            }
            const startByte = uploadedBytes;
            const endByte = uploadedBytes + bufferSize - 1;
            const uploadResponse = await fetch(uploadUrl, {
              method: "PUT",
              headers: {
                "Content-Length": bufferSize.toString(),
                "Content-Range": `bytes ${startByte}-${endByte}/${fileSize}`
              },
              body: chunk
            });
            if (!uploadResponse.ok && uploadResponse.status !== 202) {
              throw new Error(`Upload chunk failed: ${await uploadResponse.text()}`);
            }
            uploadedBytes += bufferSize;
            buffer = [];
            bufferSize = 0;
            if (uploadResponse.status === 200 || uploadResponse.status === 201) {
              const result = await uploadResponse.json();
              return new Response(
                JSON.stringify({
                  success: true,
                  file: {
                    id: result.id,
                    name: result.name,
                    size: result.size,
                    webUrl: result.webUrl
                  }
                }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
          if (done)
            break;
        }
      }
      return new Response(
        JSON.stringify({ error: "Upload failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return new Response(
          JSON.stringify({ error: "Request timeout" }),
          { status: 408, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw error;
    }
  } catch (error) {
    console.error("Remote upload error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
}
__name(handleRemoteUpload, "handleRemoteUpload");
export {
  src_default as default
};
//# sourceMappingURL=index.js.map
