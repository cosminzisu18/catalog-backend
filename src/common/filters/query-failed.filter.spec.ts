import { HttpStatus } from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { QueryFailedFilter } from './query-failed.filter';

function mockHost() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({ getResponse: () => ({ status }) }),
  } as never;
  return { host, status, json };
}

function dbError(code: string) {
  return new QueryFailedError('INSERT ...', [], { code } as unknown as Error);
}

describe('QueryFailedFilter', () => {
  const filter = new QueryFailedFilter();

  it('maps duplicate key errors to 409', () => {
    const { host, status, json } = mockHost();
    filter.catch(dbError('ER_DUP_ENTRY'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: HttpStatus.CONFLICT }),
    );
  });

  it('hides unknown database errors behind a generic 500', () => {
    const { host, status, json } = mockHost();
    jest.spyOn(filter['logger'], 'error').mockImplementation(() => undefined);

    filter.catch(dbError('ER_SOMETHING_ELSE'), host);

    expect(status).toHaveBeenCalledWith(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Eroare interna',
    });
  });
});
