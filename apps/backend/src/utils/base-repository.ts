// TODO: utils isn't the best place for this
// maybe like 'src/framework/database' or something?
import { getContext } from '@/context/app-context';

class BaseRepository {
  get db() {
    const { db } = getContext();
    return db;
  }
}

export { BaseRepository };
