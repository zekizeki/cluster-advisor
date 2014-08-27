var cadvisor = require('cadvisor')
var async = require('async')

function stats(backends, done){

	async.map(backends, function(backend, nextBackend){
		var cbackend = cadvisor(backend)

		async.parallel({
			host:function(hostDone){
				cbackend.machine(hostDone)
			},
			docker:function(dockerDone){
				cbackend.container('/docker', dockerDone)
			}
		}, function(err, results){
			if(err) return nextBackend(err)

			if(!results || !results.docker || !results.docker.subcontainers){
				return nextBackend('no subcontainers found')
			}

			var server = {
				backend:backend,
				host:results.host,
				containers:0,
				memoryused:0,
				load:0,
				rx:0,
				tx:0
			}

			async.forEach(results.docker.subcontainers, function(container, nextContainer){
				cbackend.container(container.name, function(err, results){
					if(err) return nextContainer(err)
					var stat = results.stats[results.stats.length-1]

					server.containers++
					server.memoryused += stat.memory.usage
					server.load += stat.cpu.load
					server.rx += stat.network.rx_bytes
					server.tx += stat.network.tx_bytes

					nextContainer()
				})
			}, function(err){
				if(err) return nextBackend(err)
				nextBackend(null, server)
			})

		})

	}, done)
}

function ps(backends, done){

	async.map(backends, function(backend, nextBackend){
		var cbackend = cadvisor(backend)
		cbackend.container('/docker', function(err, docker){
			if(err) return nextBackend(err)
			if(!docker || !docker.subcontainers){
				return nextBackend('no subcontainers found')
			}
			async.map(docker.subcontainers, function(container, nextContainer){
				cbackend.container(container.name, nextContainer)
			}, function(err, containers){

				if(err) return nextBackend(err)
				nextBackend(null, {
					backend:backend,
					containers:containers
				})

			})

		})
	}, done)
}


module.exports = function(backends){

	backends = backends || []

	return {
		stats:function(done){
			stats(backends, done)
		},
		ps:function(done){
			ps(backends, done)
		}
	}
}