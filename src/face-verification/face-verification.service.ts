import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AWSRekognitionService } from './aws-rekognition.service';

@Injectable()
export class FaceVerificationService {
  constructor(
    private prisma: PrismaService,
    private awsRekognition: AWSRekognitionService,
  ) {}

  // Vérifier le visage en temps réel (liveness)
  async verifyLiveFace(
    userId: string,
    imageBase64: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { isLive, confidence } = await this.awsRekognition.detectLiveness(imageBase64);

      if (!isLive || confidence < 95) {
        return {
          success: false,
          message: 'Visage non détecté correctement. Veuillez réessayer.',
        };
      }

      // Uploader l'image sur S3
      const faceImageUrl = await this.awsRekognition.uploadFaceImage(userId, imageBase64);

      // Mettre à jour l'utilisateur
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          faceVerified: true,
          faceImageUrl,
          accountStatus: 'DOCUMENTS_PENDING',
        },
      });

      return {
        success: true,
        message: 'Visage vérifié avec succès',
      };
    } catch (error) {
      console.error('Erreur de vérification du visage :', error);
      return {
        success: false,
        message: 'Erreur lors de la vérification du visage',
      };
    }
  }

  // Vérifier les mouvements de tête (gauche, droite, haut, bas)
  async verifyHeadMovements(
    userId: string,
    leftImage: string,
    rightImage: string,
    upImage: string,
    downImage: string,
  ): Promise<{ success: boolean; message: string }> {
    try {
      // Vérifier que toutes les images sont de la même personne
      const similarity1 = await this.awsRekognition.compareFaces(leftImage, rightImage);
      const similarity2 = await this.awsRekognition.compareFaces(leftImage, upImage);
      const similarity3 = await this.awsRekognition.compareFaces(leftImage, downImage);

      const avgSimilarity =
        (similarity1.similarity + similarity2.similarity + similarity3.similarity) / 3;

      if (avgSimilarity < 90) {
        return {
          success: false,
          message: 'Les images ne correspondent pas à la même personne',
        };
      }

      // Uploader l'image principale
      const faceImageUrl = await this.awsRekognition.uploadFaceImage(userId, leftImage);

      // Marquer comme vérifié
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          faceVerified: true,
          faceImageUrl,
          accountStatus: 'DOCUMENTS_PENDING',
        },
      });

      return {
        success: true,
        message: 'Vérification faciale terminée avec succès',
      };
    } catch (error) {
      console.error('Erreur de vérification des mouvements :', error);
      return {
        success: false,
        message: 'Erreur lors de la vérification',
      };
    }
  }
}