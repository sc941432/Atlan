# Simple race test: fires N concurrent book requests and prints results.
# Usage:
#   docker compose exec -T api python scripts/race_test.py --base http://localhost:8000 --token <USER_TOKEN> --event 1 --n 200 --qty 1
import argparse, asyncio, httpx

async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--base', default='http://localhost:8000')
    ap.add_argument('--token', required=True)
    ap.add_argument('--event', type=int, required=True)
    ap.add_argument('--n', type=int, default=100)
    ap.add_argument('--qty', type=int, default=1)
    ap.add_argument('--idem', action='store_true', help='send few repeating idempotency keys')
    a = ap.parse_args()

    headers = {'Authorization': f'Bearer {a.token}'}
    async with httpx.AsyncClient(timeout=10) as client:
        async def one(i):
            h = dict(headers)
            if a.idem:
                h['Idempotency-Key'] = f'k-{i%5}'  # reuse 5 keys
            r = await client.post(f'{a.base}/events/{a.event}/book', headers=h, json={'qty': a.qty})
            return r.status_code
        results = await asyncio.gather(*[one(i) for i in range(a.n)])
        from collections import Counter
        print('Status counts:', dict(Counter(results)))

if __name__ == '__main__':
    asyncio.run(main())
