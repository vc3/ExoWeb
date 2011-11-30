﻿using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Xml;
using System.IO;
using System.Text.RegularExpressions;

namespace ExoWeb.Templates.MicrosoftAjax
{
	/// <summary>
	/// Represents a block of markup in a template, which could be a bound element, control, or just plain text markup.
	/// </summary>
	class Block
	{
		#region Html Entity Mapping

		static Regex entityParser = new Regex(@"\&(?<entity>[A-Za-z]+)\;", RegexOptions.Compiled);
		static Regex ampParser = new Regex(@"\&(?!\#\d+\;)");
		static Regex xmlnsParser = new Regex(@"\sxmlns\:\w+=\"".*?\""");

		static Dictionary<string, string> entities = new Dictionary<string, string>() 
		{
			{ "quot", "&#34;" },
			{ "amp", "&#38;" },
			{ "lt", "&#60;" },
			{ "gt", "&#62;" },
			{ "nbsp", "&#160;" },
			{ "iexcl", "&#161;" },
			{ "cent", "&#162;" },
			{ "pound", "&#163;" },
			{ "curren", "&#164;" },
			{ "yen", "&#165;" },
			{ "brvbar", "&#166;" },
			{ "sect", "&#167;" },
			{ "uml", "&#168;" },
			{ "copy", "&#169;" },
			{ "ordf", "&#170;" },
			{ "laquo", "&#171;" },
			{ "not", "&#172;" },
			{ "shy", "&#173;" },
			{ "reg", "&#174;" },
			{ "macr", "&#175;" },
			{ "deg", "&#176;" },
			{ "plusmn", "&#177;" },
			{ "sup2", "&#178;" },
			{ "sup3", "&#179;" },
			{ "acute", "&#180;" },
			{ "micro", "&#181;" },
			{ "para", "&#182;" },
			{ "middot", "&#183;" },
			{ "cedil", "&#184;" },
			{ "sup1", "&#185;" },
			{ "ordm", "&#186;" },
			{ "raquo", "&#187;" },
			{ "frac14", "&#188;" },
			{ "frac12", "&#189;" },
			{ "frac34", "&#190;" },
			{ "iquest", "&#191;" },
			{ "Agrave", "&#192;" },
			{ "Aacute", "&#193;" },
			{ "Acirc", "&#194;" },
			{ "Atilde", "&#195;" },
			{ "Auml", "&#196;" },
			{ "Aring", "&#197;" },
			{ "AElig", "&#198;" },
			{ "Ccedil", "&#199;" },
			{ "Egrave", "&#200;" },
			{ "Eacute", "&#201;" },
			{ "Ecirc", "&#202;" },
			{ "Euml", "&#203;" },
			{ "Igrave", "&#204;" },
			{ "Iacute", "&#205;" },
			{ "Icirc", "&#206;" },
			{ "Iuml", "&#207;" },
			{ "ETH", "&#208;" },
			{ "Ntilde", "&#209;" },
			{ "Ograve", "&#210;" },
			{ "Oacute", "&#211;" },
			{ "Ocirc", "&#212;" },
			{ "Otilde", "&#213;" },
			{ "Ouml", "&#214;" },
			{ "times", "&#215;" },
			{ "Oslash", "&#216;" },
			{ "Ugrave", "&#217;" },
			{ "Uacute", "&#218;" },
			{ "Ucirc", "&#219;" },
			{ "Uuml", "&#220;" },
			{ "Yacute", "&#221;" },
			{ "THORN", "&#222;" },
			{ "szlig", "&#223;" },
			{ "agrave", "&#224;" },
			{ "aacute", "&#225;" },
			{ "acirc", "&#226;" },
			{ "atilde", "&#227;" },
			{ "auml", "&#228;" },
			{ "aring", "&#229;" },
			{ "aelig", "&#230;" },
			{ "ccedil", "&#231;" },
			{ "egrave", "&#232;" },
			{ "eacute", "&#233;" },
			{ "ecirc", "&#234;" },
			{ "euml", "&#235;" },
			{ "igrave", "&#236;" },
			{ "iacute", "&#237;" },
			{ "icirc", "&#238;" },
			{ "iuml", "&#239;" },
			{ "eth", "&#240;" },
			{ "ntilde", "&#241;" },
			{ "ograve", "&#242;" },
			{ "oacute", "&#243;" },
			{ "ocirc", "&#244;" },
			{ "otilde", "&#245;" },
			{ "ouml", "&#246;" },
			{ "divide", "&#247;" },
			{ "oslash", "&#248;" },
			{ "ugrave", "&#249;" },
			{ "uacute", "&#250;" },
			{ "ucirc", "&#251;" },
			{ "uuml", "&#252;" },
			{ "yacute", "&#253;" },
			{ "thorn", "&#254;" },
			{ "yuml", "&#255;" },
			{ "euro", "&#8364;" }
		};

		#endregion

		public string Markup { get; internal set; }

		public Binding If { get; internal set; }

		/// <summary>
		/// Parses and returns the blocks represented by the specified template markup.
		/// </summary>
		/// <param name="markup"></param>
		/// <returns></returns>
		protected static List<Block> Parse(string markup)
		{
			// Convert html entities to xml entities
			string xml = entityParser.Replace(markup, m =>
				{
					var group = m.Groups["entity"].Value;
					string entity;
					if (group != "" && entities.TryGetValue(group, out entity))
						return entity;
					return m.Value;
				});

			// Replace & with &amp; when not used to specify an xml entity
			xml = ampParser.Replace(xml, "&amp;");

			// Wrap the xml in a container to provide namespace aliases for supported controls
			xml = "<templates xmlns:sys='javascript:Sys' xmlns:dataview='javascript:Sys.UI.DataView' xmlns:content='javascript:ExoWeb.UI.Content' xmlns:template='javascript:ExoWeb.UI.Template' xmlns:toggle='javascript:ExoWeb.UI.Toggle' xmlns:behavior='javascript:ExoWeb.UI.Behavior' xmlns:html='javascript:ExoWeb.UI.Html' xmlns:togglegroup='javascript:ExoWeb.UI.ToggleGroup' xmlns:adapter='javascript:ExoWeb.View.Adapter'>" +
				xml +
				"</templates>";

			// Load and parse the template markup
			XmlDocument templates = new XmlDocument();
			templates.LoadXml(xml);
			return ParseElement(templates.DocumentElement);
		}

		/// <summary>
		/// Parses the specified element into a list of template blocks.
		/// </summary>
		/// <param name="element"></param>
		/// <returns></returns>
		static List<Block> ParseElement(XmlElement element)
		{
			// Track the blocks represented by the current element
			var blocks = new List<Block>();

			// Process the child nodes of the current element
			foreach (XmlNode node in element.ChildNodes)
			{
				switch (node.NodeType)
				{
					// XML Element, which could be a control, bound element start tag, or just literal content
					case XmlNodeType.Element:

						var child = (XmlElement)node;

						// Control
						if (child.HasAttribute("sys:attach"))
						{
							Control control;
							switch (child.GetAttribute("sys:attach"))
							{
								// Template
								case "template":
									bool isAdapter = child.GetAttribute("template:datatype") == "ExoWeb.View.Adapter";

									control = new Template()
									{
										Attributes = GetAttributes(child, "class", "sys:attach", "sys:if", "template:for", "template:if", "template:name", "template:datatype", "adapter:islist", "adapter:datatype"),
										Name = child.GetAttribute("template:name").Split(' '),
										IsList = child.HasAttribute("adapter:islist") ? child.GetAttribute("adapter:islist") == "true" : (bool?)null,
										IsAdapter = isAdapter,
										DataType = isAdapter ? child.GetAttribute("adapter:datatype") : child.GetAttribute("template:datatype"),
										Class = child.GetAttribute("class").Split(' ').Where(c => c != "" && c.ToLower() != "sys-template").ToArray()
									};
									break;

								// DataView
								case "dataview":
									control = new DataView()
									{
										Attributes = GetAttributes(child, "sys:attach", "sys:if", "dataview:data"),
										Data = GetBinding(child, "dataview:data")
									};
									break;

								// Content
								case "content":
									control = new Content()
									{
										Attributes = GetAttributes(child, "sys:attach", "sys:if", "content:data", "content:template"),
										Data = GetBinding(child, "content:data"),
										Template = child.GetAttribute("content:template").Split(' ')
									};
									break;

								// Toggle
								case "toggle":
									control = new Toggle()
									{ };
									break;

								// ToggleGroup
								case "togglegroup":
									control = new ToggleGroup() { };
									break;

								// Behavior
								case "behavior":
									control = new Behavior() { };
									break;

								// Html
								case "html":
									control = new Html() { };
									break;

								default:
									throw new ArgumentException("Controls of type '" + child.GetAttribute("sys:attach") + "' are not supported for server rendering.");
							}

							// Process the controls child blocks
							control.Blocks = ParseElement(child);
							control.Tag = child.Name;
							control.Markup = GetMarkup(child);
							control.If = GetBinding(child, "sys:if");

							// Add the control
							blocks.Add(control);
						}

						// Element
						else if (child.Attributes.Cast<XmlAttribute>().Any(a => a.Value.StartsWith("{") && a.Value.EndsWith("}")) ||
								 (child.ChildNodes.Cast<XmlNode>().All(n => n.NodeType != XmlNodeType.Element) && child.InnerXml.Trim().StartsWith("{") && child.InnerXml.Trim().EndsWith("}")))
						{
							var isClosed = child.ChildNodes.Count == 0 || (child.InnerXml.Trim().StartsWith("{") && child.InnerXml.Trim().EndsWith("}"));

							// Add the bound element
							blocks.Add(new Element()
							{
								Markup = isClosed ? GetMarkup(child) : GetElementMarkup(child),
								Attributes = GetAttributes(child, "sys:if"),
								Tag = child.Name,
								IsClosed = isClosed,
								Binding = child.InnerXml.Trim().StartsWith("{") && child.InnerXml.Trim().EndsWith("}") ? Binding.Parse(child.InnerXml.Trim()) : null,
								If = child.HasAttribute("sys:if") ? Binding.Parse(child.GetAttribute("sys:if")) : null
							});

							// Process child nodes, if the element content is not bound
							if (!isClosed)
							{
								var childElementList = ParseElement(child);

								//loop over the list and add the If statement to all block elements
								foreach (var currChildElement in childElementList)
								{
									if (currChildElement.GetType() == typeof(Block))
									{
										if (currChildElement.If == null)
										{
											currChildElement.If = child.HasAttribute("sys:if") ? Binding.Parse(child.GetAttribute("sys:if")) : null;
										}
									}
								}

								blocks.AddRange(childElementList);
								blocks.Add(new Block() 
								{ 
									Markup = "</" + child.Name + ">",
									If = child.HasAttribute("sys:if") ? Binding.Parse(child.GetAttribute("sys:if")) : null
								});
							}
						}

						// Literal
						else
						{
							// Get the blocks contained by the literal element
							var children = ParseElement(child);

							// Add the entire element as a block if it only contains literal content
							if (children.Count == 0 || (children.Count == 1 && children.First().GetType() == typeof(Block)))
								blocks.Add(new Block() { Markup = GetMarkup(child) });

							// Otherwise, process the child blocks
							else
							{
								blocks.Add(new Block() { Markup = GetElementMarkup(child) });
								blocks.AddRange(children);
								blocks.Add(new Block() { Markup = "</" + child.Name + ">" });
							}
						}
						break;

					// Literal content
					case XmlNodeType.Text:
						blocks.Add(new Block() { Markup = GetMarkup(node) });
						break;
				}
			}

			// Condense adjacent literal blocks
			Block literal = null;
			for (int i = blocks.Count - 1; i >= 0; i--)
			{
				if (blocks[i].GetType() == typeof(Block))
				{
					if (literal == null)
						literal = blocks[i];
					else
					{
						//if there is a conditional display, do not move the adjacent block
						//because you do not want end tags to be removed from rendering
						if (blocks[i].If != null)
						{
							literal = null;
						}
						else
						{
							//combine the adjacent blocks
							literal.Markup = blocks[i].Markup + literal.Markup;
							blocks.RemoveAt(i);
						}
					}
				}
				else
					literal = null;
			}

			return blocks;
		}

		/// <summary>
		/// Gets the HTML markup for the specified <see cref="XmlNode"/>.
		/// </summary>
		/// <param name="node"></param>
		/// <returns></returns>
		static string GetMarkup(XmlNode node)
		{
			return xmlnsParser.Replace(node.OuterXml, "");
		}

		static Binding GetBinding(XmlElement child, string attributeName)
		{
			return child.HasAttribute(attributeName) ? Binding.Parse(child.GetAttribute(attributeName)) : null;
		}

		static List<Attribute> GetAttributes(XmlElement child, params string[] exceptions)
		{
			return child.Attributes
				.Cast<XmlAttribute>()
				.Where(a => exceptions == null || !exceptions.Contains(a.Name))
				.Select(a => new Attribute()
					{
						Name = a.Name,
						Value = a.Name.ToLower() == "class" ? a.Value.Replace("sys-template", "").Trim() : a.Value,
						Binding = a.Value.Trim().StartsWith("{") && a.Value.Trim().EndsWith("}") ? Binding.Parse(a.Value.Trim()) : null
					})
				.ToList();
		}

		/// <summary>
		/// Gets the markup for the start element tag.
		/// </summary>
		/// <param name="element"></param>
		/// <returns></returns>
		static string GetElementMarkup(XmlElement element)
		{
			string markup = "<" + element.Name;
			foreach (XmlAttribute attribute in element.Attributes)
				markup += " " + attribute.Name + "=\"" + attribute.Value + "\"";
			markup += ">";
			return markup;
		}

		public override string ToString()
		{
			return Markup;
		}

		/// <summary>
		/// Renders the block to the specified writer in the context of the specified page.
		/// </summary>
		/// <param name="page"></param>
		/// <param name="writer"></param>
		internal virtual void Render(AjaxPage page, TextWriter writer)
		{
			// Exit immediately if the element is conditionally hidden
			if (If != null && If.Evaluate(page) as bool? == false)
				return;

			writer.Write(Markup);
		}
	}
}
