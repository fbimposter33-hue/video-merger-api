const express = require('express');
const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args)); // যদি node-fetch v3 ব্যবহার করেন

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
    res.send('FFmpeg Local Merger API is running!');
});

// হেল্পার ফাংশন: রিমোট ফাইল লোকাল ফোল্ডারে ডাউনলোড করার জন্য
async function downloadFile(url, outputPath) {
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            'Referer': 'https://www.snapyt.app/'
        }
    });
    if (!res.ok) throw new Error(`Failed to fetch ${url} - Status: ${res.status}`);
    
    const fileStream = fs.createWriteStream(outputPath);
    await new Promise((resolve, reject) => {
        res.body.pipe(fileStream);
        res.body.on('error', reject);
        fileStream.on('finish', resolve);
    });
}

app.get('/merge', async (req, res) => {
    const videoUrl = req.query.video;
    const audioUrl = req.query.audio;

    if (!videoUrl || !audioUrl) {
        return res.status(400).json({ error: 'Please provide ?video= and ?audio= URLs' });
    }

    const timestamp = Date.now();
    const videoPath = path.join('/tmp', `video_${timestamp}.mp4`);
    const audioPath = path.join('/tmp', `audio_${timestamp}.mp4`);
    const outputPath = path.join('/tmp', `output_${timestamp}.mp4`);

    try {
        console.log('Downloading video and audio streams locally...');
        
        // ১. একসাথে বা ধাপে ধাপে ভিডিও ও অডিও ডাউনলোড করা
        await Promise.all([
            downloadFile(videoUrl, videoPath),
            downloadFile(audioUrl, audioPath)
        ]);

        console.log('Merging local files with FFmpeg...');

        // ২. লোকাল ফাইল দুটি FFmpeg দিয়ে মার্জ করা
        await new Promise((resolve, reject) => {
            ffmpeg()
                .input(videoPath)
                .input(audioPath)
                .outputOptions([
                    '-c:v copy',
                    '-c:a aac',
                    '-strict experimental'
                ])
                .save(outputPath)
                .on('end', resolve)
                .on('error', reject);
        });

        console.log('Merge finished successfully!');

        // ৩. ইউজারের ব্রাউজারে ফাইল ডাউনলোড করিয়ে দেওয়া
        res.download(outputPath, 'merged_video.mp4', (err) => {
            if (err) console.error('Download error:', err);
            
            // সব টেম্পোরারি ফাইল ডিলিট করে সার্ভার ক্লিন রাখা
            [videoPath, audioPath, outputPath].forEach(file => {
                if (fs.existsSync(file)) fs.unlinkSync(file);
            });
        });

    } catch (err) {
        console.error('Process error:', err.message);
        
        // কোনো এরর হলে টেম্পোরারি ফাইলগুলো মুছে ফেলা
        [videoPath, audioPath, outputPath].forEach(file => {
            if (fs.existsSync(file)) fs.unlinkSync(file);
        });

        res.status(500).json({ error: 'Failed to process video: ' + err.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
