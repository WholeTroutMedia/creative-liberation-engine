import asyncio, sys

async def pipe(reader, writer):
    try:
        while True:
            data = await reader.read(65536)
            if not data:
                break
            writer.write(data)
            await writer.drain()
    except:
        pass
    finally:
        writer.close()

async def handle(client_reader, client_writer):
    try:
        upstream_reader, upstream_writer = await asyncio.open_connection('127.0.0.1', 9223)
        await asyncio.gather(
            pipe(client_reader, upstream_writer),
            pipe(upstream_reader, client_writer)
        )
    except Exception as e:
        print(f'proxy error: {e}', file=sys.stderr)
    finally:
        client_writer.close()

async def main():
    server = await asyncio.start_server(handle, '0.0.0.0', 9224)
    print('CDP proxy listening on 0.0.0.0:9224', flush=True)
    async with server:
        await server.serve_forever()

asyncio.run(main())
