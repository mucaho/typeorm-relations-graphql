import { GraphQLResolveInfo } from 'graphql';
import { IResolvers } from 'graphql-tools';
import { getConnection } from 'typeorm';
import { Product } from './entities/product';
import { Image, ImageSizeMap } from './entities/image';
import { RelationMapper } from '../src';
import { Video } from './entities/video';

export interface TestResolverContext {
  resolveInfoHook: (info: GraphQLResolveInfo) => void;
}

// language=GraphQL
export const typeDefs = `
  type Owner {
    id: Int!
    name: String
  }

  type Product {
    id: Int!
    name: String
    owner: Owner
    store: Store
    images: [Image!]
    videos: [Video!]
    media: [MediaTypeUnion!]
  }

  type Store {
    id: Int!
    name: String
    owner: Owner
  }

  type Image {
    id: Int!
    sizes: ImageSizeMap
    product: Product!
  }

  type ImageFile {
    id: Int!
    fileName: String
  }

  type ImageSizeMap {
    small: ImageFile
    medium: ImageFile
    large: ImageFile
  }

  type Video {
    id: Int!
    duration: Int!
    product: Product!
  }

  union MediaTypeUnion = Image | Video

  type Query {
    products: [Product]!
  }

  schema {
    query: Query
  }
`;

export const resolvers: IResolvers<any, TestResolverContext> = {
  Query: {
    products(source: any, args: any, context: TestResolverContext, info: GraphQLResolveInfo): Promise<Product[]> {
      context.resolveInfoHook(info);

      const connection = getConnection();
      const productRelations = new RelationMapper(connection).buildRelationListForQuery(Product, info);

      return connection.getRepository(Product).find({
        relations: productRelations,
      });
    },
  },
  Image: {
    sizes(source: Image): ImageSizeMap {
      return {
        small: source.sizeSmall,
        medium: source.sizeMedium,
        large: source.sizeLarge,
      };
    },
  },
  Product: {
    async media(
      source: Product,
      args: any,
      context: TestResolverContext,
      info: GraphQLResolveInfo,
    ): Promise<(Image | Video)[]> {
      const connection = getConnection();

      const imageRelations = new RelationMapper(connection).buildRelationListForQuery(Image, info);
      const videoRelations = new RelationMapper(connection).buildRelationListForQuery(Video, info);

      const images = await connection.getRepository(Image).find({
        where: {
          product: source,
        },
        relations: imageRelations,
      });
      const videos = await connection.getRepository(Video).find({
        where: {
          product: source,
        },
        relations: videoRelations,
      });

      return [...images, ...videos];
    },
  },
  MediaTypeUnion: {
    __resolveType(value: Image | Video): 'Image' | 'Video' | null {
      if (value instanceof Image) {
        return 'Image';
      }

      if (value instanceof Video) {
        return 'Video';
      }

      return null;
    },
  },
};
