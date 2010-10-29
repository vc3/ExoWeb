﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using ExoGraph;
using ExoRule;

namespace ExoWeb
{
	/// <summary>
	/// Represents a response to a service request.  Depending on the type of request, different values will be 
	/// initialize on the instance.
	/// </summary>
	internal class ServiceResponse : IJsonSerializable
	{
		public Dictionary<string, GraphType> Types { get; internal set; }

		public Dictionary<string, GraphTypeInfo> Instances { get; internal set; }

		public Dictionary<string, List<Condition>> Conditions { get; internal set; }

		public object[] Events { get; internal set; }

		public GraphTransaction Changes { get; internal set; }

		public GraphTypeInfo GetGraphTypeInfo(GraphType type)
		{
			// Create the set of type instance information if not initialized
			if (Instances == null)
				Instances = new Dictionary<string,GraphTypeInfo>();
			
			// Get or initialize the graph type instance information store
			GraphTypeInfo typeInfo;
			if (!Instances.TryGetValue(type.Name, out typeInfo))
				Instances[type.Name] = typeInfo = new GraphTypeInfo();

			// Return the requested value
			return typeInfo;
		}

		#region IJsonSerializable

		void IJsonSerializable.Serialize(Json json)
		{
			if (Types != null && Types.Any())
				json.Set("types", Types);

			if (Instances != null && Instances.Any())
				json.Set("instances", Instances);

			if (Conditions != null && Conditions.Any())
				json.Set("conditions", Conditions);

			if (Events != null && Events.Any())
				json.Set("events", Events);

			if (Changes != null && Changes.Any())
				json.Set("changes", (IEnumerable<GraphEvent>)Changes);
		}

		object IJsonSerializable.Deserialize(Json json)
		{
			throw new NotSupportedException("JSON service responses should never be deserialized on the server.");
		}

		#endregion
	}
}