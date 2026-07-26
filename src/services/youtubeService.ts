
const YOUTUBE_API_KEY = "AIzaSyBDZ82m0LP6XT2K1-xGEyQhzVKMASf1l-E";

export async function searchYouTube(query: string): Promise<string | null> {
  try {
    // 1. Refine query for songs if needed
    let refinedQuery = query;
    const songKeywords = ['song', 'music', 'sing', 'track', 'listen', 'play', 'গান', 'বাজাও', 'শোনাও'];
    const isLikelySong = songKeywords.some(kw => query.toLowerCase().includes(kw));
    const hasBengali = /[\u0980-\u09FF]/.test(query);
    
    if (isLikelySong && !query.toLowerCase().includes('video')) {
      refinedQuery = `${query} official music video`;
    }

    // 2. Initial Search
    const searchParams: any = {
      part: 'snippet',
      q: refinedQuery,
      type: 'video',
      videoEmbeddable: 'true',
      videoSyndicated: 'true',
      maxResults: 15,
      order: 'relevance',
      key: YOUTUBE_API_KEY,
    };

    if (hasBengali) {
      searchParams.relevanceLanguage = 'bn';
    }

    const searchUrl = `https://www.googleapis.com/youtube/v3/search?${new URLSearchParams(searchParams)}`;
    const searchResponse = await fetch(searchUrl);
    
    if (!searchResponse.ok) {
      const errorData = await searchResponse.json();
      console.error("YouTube Search API Error:", errorData);
      return null;
    }

    const searchData = await searchResponse.json();
    if (!searchData.items || searchData.items.length === 0) return null;

    // 3. Fetch Video Details for filtering
    const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');
    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=status,contentDetails,statistics,snippet&id=${videoIds}&key=${YOUTUBE_API_KEY}`;
    
    const detailsResponse = await fetch(detailsUrl);
    if (!detailsResponse.ok) return searchData.items[0].id.videoId; // Fallback

    const detailsData = await detailsResponse.json();
    const videoDetails = detailsData.items || [];

    // 4. Advanced Filtering & Ranking
    // We want videos that are:
    // - Embeddable (status.embeddable)
    // - Not restricted (contentDetails.regionRestriction)
    // - Not from "Topic" channels (unless no other choice)
    // - High view count (statistics.viewCount)
    
    const candidates = videoDetails.filter((video: any) => {
      const isEmbeddable = video.status.embeddable;
      const isPublic = video.status.privacyStatus === 'public';
      const title = video.snippet.title.toLowerCase();
      const channelTitle = video.snippet.channelTitle.toLowerCase();
      
      // Basic sanity checks
      // CRITICAL: We MUST NOT return non-embeddable videos as they will fail in our player.
      if (!isEmbeddable || !isPublic) return false;
      if (title.includes('unavailable') || title.includes('deleted')) return false;
      
      // Check for region restrictions if possible (though we don't know the user's region for sure)
      // But we can at least avoid videos with heavy restrictions
      if (video.contentDetails.regionRestriction?.blocked) {
        // If it's blocked in many regions, it's risky
        if (video.contentDetails.regionRestriction.blocked.length > 5) return false;
      }

      return true;
    });

    if (candidates.length === 0) {
      // If no embeddable candidates found, and we haven't tried a "clean" search yet, try one.
      if (!query.includes('official')) {
        console.log("No embeddable videos found. Trying alternative search...");
        return searchYouTube(`${query} official`);
      }
      return null; // Better to return null than a broken video
    }

    // Sort candidates:
    // 1. Prioritize non-"Topic" channels
    // 2. Prioritize "Official" in title
    // 3. Sort by view count (descending)
    const sortedCandidates = candidates.sort((a: any, b: any) => {
      const aTitle = a.snippet.title.toLowerCase();
      const bTitle = b.snippet.title.toLowerCase();
      const aIsTopic = a.snippet.channelTitle.toLowerCase().includes('topic');
      const bIsTopic = b.snippet.channelTitle.toLowerCase().includes('topic');
      
      // Topic channels are lowest priority
      if (aIsTopic && !bIsTopic) return 1;
      if (!aIsTopic && bIsTopic) return -1;
      
      // Official videos are high priority
      const aIsOfficial = aTitle.includes('official') || aTitle.includes('original');
      const bIsOfficial = bTitle.includes('official') || bTitle.includes('original');
      
      if (aIsOfficial && !bIsOfficial) return -1;
      if (!aIsOfficial && bIsOfficial) return 1;
      
      const aViews = parseInt(a.statistics.viewCount || '0');
      const bViews = parseInt(b.statistics.viewCount || '0');
      return bViews - aViews;
    });

    const bestMatch = sortedCandidates[0];
    console.log(`YouTube Search (Robust): Found ${candidates.length} candidates. Picking: ${bestMatch.snippet.title} (Views: ${bestMatch.statistics.viewCount})`);
    
    return bestMatch.id;
  } catch (error) {
    console.error("Failed to search YouTube:", error);
    return null;
  }
}

export async function searchYouTubeList(query: string): Promise<any[]> {
  try {
    const searchParams: any = {
      part: 'snippet',
      q: query,
      type: 'video',
      videoEmbeddable: 'true',
      videoSyndicated: 'true',
      maxResults: 20,
      order: 'relevance',
      key: YOUTUBE_API_KEY,
    };

    const searchUrl = `https://www.googleapis.com/youtube/v3/search?${new URLSearchParams(searchParams)}`;
    const searchResponse = await fetch(searchUrl);
    
    if (!searchResponse.ok) return [];

    const searchData = await searchResponse.json();
    if (!searchData.items) return [];

    const videoIds = searchData.items.map((item: any) => item.id.videoId).join(',');
    const detailsUrl = `https://www.googleapis.com/youtube/v3/videos?part=status,contentDetails,statistics,snippet&id=${videoIds}&key=${YOUTUBE_API_KEY}`;
    
    const detailsResponse = await fetch(detailsUrl);
    if (!detailsResponse.ok) return searchData.items;

    const detailsData = await detailsResponse.json();
    const videoDetails = detailsData.items || [];

    // Filter for embeddable only
    return videoDetails.filter((v: any) => v.status.embeddable && v.status.privacyStatus === 'public');
  } catch (error) {
    console.error("Failed to fetch YouTube list:", error);
    return [];
  }
}

export async function getTrendingVideos(): Promise<any[]> {
  try {
    const url = `https://www.googleapis.com/youtube/v3/videos?part=status,contentDetails,statistics,snippet&chart=mostPopular&regionCode=BD&maxResults=20&key=${YOUTUBE_API_KEY}`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    const items = data.items || [];
    return items.filter((v: any) => v.status.embeddable && v.status.privacyStatus === 'public');
  } catch (error) {
    console.error("Failed to fetch trending videos:", error);
    return [];
  }
}
