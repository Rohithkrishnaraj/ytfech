// app/api/videos/route.ts
import { NextResponse } from "next/server";

type YouTubeVideo = {
  id?: {
    videoId?: string;
  };
  snippet?: {
    title?: string;
    thumbnails?: {
      medium?: {
        url?: string;
      };
    };
  };
};

type SanitizedVideo = {
  id: {
    videoId: string;
  };
  snippet: {
    title: string;
    thumbnails: {
      medium: {
        url: string;
      };
    };
  };
};

// When a request is made to /api/videos?access_token=xxx
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const accessToken = searchParams.get("access_token");
  
  if (!accessToken) {
    return NextResponse.json({ error: "Access token required" }, { status: 401 });
  }

  try {
    console.log('Fetching channel with access token:', accessToken.substring(0, 10) + '...');

    // First, get the user's channel information
    const channelResponse = await fetch(
      'https://www.googleapis.com/youtube/v3/channels?part=id,snippet&mine=true',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
      }
    );

    const channelData = await channelResponse.json();
    console.log('Channel API Response:', channelData);

    if (channelData.error) {
      console.error('YouTube API Error:', channelData.error);
      return NextResponse.json({ 
        error: channelData.error.message || "YouTube API Error",
        details: channelData.error
      }, { status: channelData.error.code || 400 });
    }
    
    if (!channelData.items || channelData.items.length === 0) {
      return NextResponse.json({ error: "No YouTube channel found" }, { status: 404 });
    }

    const channelId = channelData.items[0].id;
    const channelTitle = channelData.items[0].snippet?.title || 'My Channel';

    console.log('Found channel:', { channelId, channelTitle });

    // Now fetch videos for the user's channel
    const youtubeApiUrl = `https://www.googleapis.com/youtube/v3/search?key=${process.env.YOUTUBE_API_KEY}&channelId=${channelId}&part=snippet,id&order=date&maxResults=10&type=video`;

    const response = await fetch(youtubeApiUrl, {
      headers: {
        'Accept': 'application/json',
      },
    });

    const data = await response.json();
    console.log('Videos API Response:', {
      status: response.status,
      error: data.error,
      itemCount: data.items?.length,
    });

    if (!response.ok || data.error) {
      console.error('YouTube Videos API Error:', data.error || data);
      return NextResponse.json({ 
        error: data.error?.message || "Failed to fetch videos",
        details: data.error
      }, { status: response.status });
    }

    // Ensure each video has required properties
    const sanitizedVideos = data.items?.map((item: YouTubeVideo): SanitizedVideo => ({
      id: {
        videoId: item.id?.videoId || '',
      },
      snippet: {
        title: item.snippet?.title || '',
        thumbnails: {
          medium: {
            url: item.snippet?.thumbnails?.medium?.url || '',
          },
        },
      },
    })).filter((video: SanitizedVideo) => video.id.videoId && video.snippet.thumbnails.medium.url) || [];

    return NextResponse.json({
      items: sanitizedVideos,
      channelTitle,
      channelId,
    });
  } catch (error) {
    console.error('Error fetching videos:', error);
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
