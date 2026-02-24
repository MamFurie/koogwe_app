import { Injectable } from '@nestjs/common';
import { RekognitionClient, DetectFacesCommand, CompareFacesCommand } from '@aws-sdk/client-rekognition';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

@Injectable()
export class AWSRekognitionService {
  private rekognition: RekognitionClient;
  private s3: S3Client;

  constructor() {
    const config = {
      region: process.env.AWS_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    };

    this.rekognition = new RekognitionClient(config);
    this.s3 = new S3Client(config);
  }

  async detectLiveness(imageBase64: string): Promise<{ isLive: boolean; confidence: number }> {
    try {
      const buffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');

      const command = new DetectFacesCommand({
        Image: { Bytes: buffer },
        Attributes: ['ALL'],
      });

      const result = await this.rekognition.send(command);

      if (!result.FaceDetails || result.FaceDetails.length === 0) {
        return { isLive: false, confidence: 0 };
      }

      const face = result.FaceDetails[0];

      const hasGoodQuality =
        face.Quality?.Brightness > 50 &&
        face.Quality?.Sharpness > 50;

      const isWellPositioned =
        face.Pose?.Pitch < 30 && face.Pose?.Pitch > -30 &&
        face.Pose?.Roll < 30 && face.Pose?.Roll > -30 &&
        face.Pose?.Yaw < 30 && face.Pose?.Yaw > -30;

      const eyesOpen =
        face.EyesOpen?.Value &&
        face.EyesOpen?.Confidence > 90;

      const isLive = hasGoodQuality && isWellPositioned && eyesOpen;
      const confidence = face.Confidence ?? 0;

      return { isLive: !!isLive, confidence };
    } catch (error) {
      console.error('Erreur détection liveness :', error);
      return { isLive: false, confidence: 0 };
    }
  }

  async uploadFaceImage(userId: string, imageBase64: string): Promise<string> {
    try {
      const buffer = Buffer.from(imageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      const key = `faces/${userId}/${Date.now()}.jpg`;

      const command = new PutObjectCommand({
        Bucket: process.env.AWS_S3_BUCKET!,
        Key: key,
        Body: buffer,
        ContentType: 'image/jpeg',
      });

      await this.s3.send(command);

      return `https://${process.env.AWS_S3_BUCKET}.s3.amazonaws.com/${key}`;
    } catch (error) {
      console.error("Erreur upload image :", error);
      throw error;
    }
  }

  async compareFaces(sourceImageBase64: string, targetImageBase64: string): Promise<{ similarity: number }> {
    try {
      const sourceBuffer = Buffer.from(sourceImageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      const targetBuffer = Buffer.from(targetImageBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64');

      const command = new CompareFacesCommand({
        SourceImage: { Bytes: sourceBuffer },
        TargetImage: { Bytes: targetBuffer },
        SimilarityThreshold: 90,
      });

      const result = await this.rekognition.send(command);

      if (result.FaceMatches && result.FaceMatches.length > 0) {
        return { similarity: result.FaceMatches[0].Similarity ?? 0 };
      }

      return { similarity: 0 };
    } catch (error) {
      console.error('Erreur comparaison visages :', error);
      return { similarity: 0 };
    }
  }
}